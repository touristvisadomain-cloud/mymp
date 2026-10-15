/**
 * Fills the pages that are still empty.
 *
 * The hourly search walks the whole House a few members at a time and only
 * asks about the outlets that have no feed. A member who reached print in
 * March and not since stays empty for good that way. This asks Google News
 * once per empty member, by every Bangla spelling of their name, for anything
 * since the feed window opened, and keeps only what one of the listed outlets
 * published (config/news-sources.ts). The matcher then decides, as it does for
 * every story, whether the story is really about them.
 *
 *   npm run feed:fill                  every member with no news on their page
 *   npm run feed:fill -- --all         every sitting member
 *   npm run feed:fill -- --only <id>   one member
 *   npm run feed:fill -- --dry-run     report, write nothing
 *
 * Google News' RSS needs no key. A query a second and a half apart is a
 * trickle; a member whose name returns a full page is asked again month by
 * month so the older stories are reached too.
 */
import fs from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

import { NEWS_SOURCES } from '../config/news-sources';
import { allMembers } from '../src/lib/data';
import { buildIndex, ingest, type IngestCounts } from '../src/lib/feed/collect';
import { findRun, matchItem, textTokens, type MpMatch } from '../src/lib/feed/matchMp';
import { foldBangla, HONORIFICS, INITIALS } from '../src/lib/matching/nameMatch';
import { searchProvider } from '../src/lib/feed/searchProvider';
import { finishRun, startRun, type FeedItemInput } from '../src/lib/feed/store';
import { FEED_FROM } from '../src/lib/feed/window';
import { restDb } from '../src/lib/posts/db';

const argOf = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (u: string) => new URL(u).hostname.replace(/^www\./, '');

/** Every listed outlet's host, and the outlet it belongs to. */
const OUTLETS = NEWS_SOURCES.map((s) => ({ source: s, host: host(s.homepage) }));
const outletOf = (h: string | null | undefined) => {
  if (!h) return null;
  const bare = h.replace(/^(www|m|en|bangla|english)\./, '');
  return OUTLETS.find((o) => bare === o.host || bare.endsWith(`.${o.host}`) || o.host.endsWith(`.${bare}`))?.source ?? null;
};

/** A name as a headline writes it: no honorific, no initial-only word, no bracketed nickname. */
function plainName(raw: string): string | null {
  const words = raw.replace(/\([^)]*\)/g, ' ').replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => {
    const f = foldBangla(w.replace(/[ঃ:]$/, ''));
    return !HONORIFICS.has(f) && !INITIALS.has(f) && !HONORIFICS.has(foldBangla(w));
  });
  return kept.length >= 2 ? kept.join(' ') : words.length >= 2 ? words.join(' ') : null;
}

/** The name as the roll writes it, less the bracketed nickname and the commas between initials. */
const asWritten = (raw: string) => raw.replace(/\([^)]*\)/g, ' ').replace(/[,]/g, ' ').replace(/^(মোঃ|মো\.|আলহাজ্ব|এডভোকেট|অ্যাডভোকেট|মিসেস|মোছাঃ|মোসাম্মৎ|ডাঃ|ডা\.)\s+/u, '').replace(/\s+/g, ' ').trim();

const spellings = (raws: (string | null | undefined)[]) => {
  const bn = raws.filter((r): r is string => !!r && /[ঀ-৿]/.test(r));
  const all = [...bn.map(plainName), ...bn.map(asWritten)].filter((x): x is string => !!x && x.split(' ').length >= 2);
  return [...new Set(all)].slice(0, 5);
};

/**
 * A search for a name brings back everyone who shares it: an actor, a
 * savings officer, a singer. A name in the headline is enough for the matcher
 * when the story came from a feed; a story found by asking for that name needs
 * one more thing that points at the member: their seat, district, party or
 * office, a word that says MP or candidate, or a name of three words or more.
 */
const MP_WORDS = ['এমপি', 'সংসদ', 'সাংসদ', 'মন্ত্রী', 'প্রার্থী', 'আসন', 'মনোনয়ন', 'নির্বাচিত', 'নবনির্বাচিত', 'ধানের', 'দাঁড়িপাল্লা'].flatMap(textTokens);

/** An MP word within three words of the name, so a minister elsewhere in the headline does not count. */
function besideName(label: string, title: string): boolean {
  const name = label.split(' ').filter(Boolean);
  const t = textTokens(title);
  const i = findRun(t, name);
  if (i < 0) return false;
  const near = [...t.slice(Math.max(0, i - 3), i), ...t.slice(i + name.length, i + name.length + 3)];
  return near.some((w) => MP_WORDS.some((mw) => w.includes(mw)));
}

function sure(match: MpMatch, title: string): boolean {
  if (match.lowConfidence || !match.named) return false;
  if (match.signals.some((s) => s.signal === 'namesake-context')) return false;
  if (match.signals.some((s) => s.signal !== 'name-in-title' && s.signal !== 'name-in-summary' && s.points > 0)) return true;
  const label = match.nameLabel ?? '';
  if (besideName(label, title)) return true;
  return label.split(' ').filter(Boolean).length >= 3;
}

/** Members with at least one visible, confident story of this type. */
async function covered(type: 'news' | 'video'): Promise<Set<string>> {
  const out = new Set<string>();
  const db = restDb();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  for (let from = 0; ; from += 1000) {
    const rows = await db.get<{ mp_id: string }[]>(
      `feed_item_mps?status=eq.visible&low_confidence=is.false&select=mp_id,feed_items!inner(type)&feed_items.type=eq.${type}&order=feed_item_id,mp_id&offset=${from}&limit=1000`,
    );
    for (const r of rows) out.add(r.mp_id);
    if (rows.length < 1000) return out;
  }
}

/** The month spans from the window's start to today, newest first, as Google's after:/before: take them. */
function months(): { after: string; before: string }[] {
  const out: { after: string; before: string }[] = [];
  const start = new Date(`${FEED_FROM}T00:00:00Z`);
  const now = new Date();
  for (let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); d >= start; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const prev = new Date(d.getTime() - 86_400_000);
    out.push({ after: prev.toISOString().slice(0, 10), before: next.toISOString().slice(0, 10) });
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const only = argOf('only');
  const gap = Number(argOf('gap') ?? 1.5) * 1000;
  const provider = searchProvider();
  if (!provider) throw new Error('no search provider is configured');

  const index = await buildIndex();
  const sitting = allMembers.filter((m) => !m.resignedOn);
  const haveNews = process.argv.includes('--all') || only ? new Set<string>() : await covered('news');
  const todo = sitting.filter((m) => (only ? m.id === only : !haveNews.has(m.id)));
  console.log(`${todo.length} members to search${dryRun ? ' (dry run)' : ''}\n`);

  const run = dryRun ? null : await startRun('search', 'fill');
  const counts: IngestCounts = { found: 0, stored: 0, attached: 0, lowConfidence: 0, unmatched: 0 };
  const errors: { source: string; message: string }[] = [];
  const windowStart = Date.parse(`${FEED_FROM}T00:00:00Z`) - 6 * 3_600_000;
  const dayBefore = new Date(Date.parse(`${FEED_FROM}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const perMember: { name: string; hits: number; linked: number }[] = [];
  let queries = 0;
  const shown: string[] = [];

  for (const [n, m] of todo.entries()) {
    const entry = index.entries.find((e) => e.mp.id === m.id);
    // Every Bangla spelling as people write it, honorifics dropped: "মোঃ",
    // "এডভোকেট" and a nickname in brackets are not in most headlines.
    const names = spellings([m.nameBn, ...(entry?.mp.variants ?? []).filter((v) => v.weight >= 0.6).map((v) => v.variant)]);
    if (!names.length) continue;
    const terms = names.map((x) => `"${x}"`).join(' OR ');

    const items = new Map<string, FeedItemInput>();
    const ask = async (span: string) => {
      queries++;
      try {
        const hits = await provider.search(`${terms} ${span}`, { limit: 100 });
        for (const h of hits) {
          const outlet = outletOf(h.outletHost ?? (() => { try { return host(h.url); } catch { return null; } })());
          if (!outlet) continue;
          if (h.publishedAt && Date.parse(h.publishedAt) < windowStart) continue;
          items.set(h.url, {
            type: 'news',
            title: h.title,
            url: h.url,
            summary: h.summary,
            outletName: outlet.nameBn,
            outletId: outlet.key,
            publishedAt: h.publishedAt ?? new Date().toISOString(),
            source: 'search',
          });
        }
        return hits.length;
      } catch (e) {
        errors.push({ source: 'search', message: `${m.nameBn}: ${(e as Error).message}` });
        return 0;
      } finally {
        await wait(gap);
      }
    };

    // A full page means more is left: ask again a month at a time.
    const first = await ask(`after:${dayBefore}`);
    if (first >= 90) for (const span of months()) await ask(`after:${span.after} before:${span.before}`);

    const list = [...items.values()];
    // Which of them the matcher gives to this member, which is what the page will show.
    const mine = list.filter((i) => matchItem(index, { title: i.title, summary: i.summary }).some((x) => x.mpId === m.id && sure(x, i.title)));
    const theirs = mine.length;
    if (process.argv.includes('--show')) for (const i of mine) shown.push(`${m.nameBn} | ${m.seat?.nameBn ?? ''} | ${i.outletName} | ${i.publishedAt?.slice(0, 10)} | ${i.title}`);
    if (!dryRun) await ingest(mine, index, counts, undefined, { onlyMatched: true });
    perMember.push({ name: m.nameBn ?? m.id, hits: list.length, linked: theirs });
    process.stdout.write(
      `\r${String(n + 1).padStart(3)}/${todo.length}  queries ${queries}  filled ${perMember.filter((p) => p.linked).length}  stories for them ${perMember.reduce((a, p) => a + p.linked, 0)}      `,
    );
  }

  console.log('\n');
  console.log(`queries          ${queries}`);
  console.log(`stories read     ${counts.found}`);
  console.log(`stored           ${counts.stored}${dryRun ? ' (dry run: nothing written)' : ''}`);
  console.log(`new links        ${counts.attached}  (${counts.lowConfidence} to review)`);
  console.log(`not about them   ${counts.unmatched}`);
  if (errors.length) console.log(`errors           ${errors.length}: ${errors[0]!.message}`);
  const filled = perMember.filter((p) => p.linked > 0);
  console.log(`members filled   ${filled.length} of ${perMember.length}`);
  console.log(`stories for them ${perMember.reduce((a, p) => a + p.linked, 0)}`);
  for (const p of perMember.filter((x) => !x.linked)) console.log(`  still empty: ${p.name} (${p.hits} outlet stories, none about them)`);

  if (shown.length) fs.writeFileSync(argOf('show') ?? 'fill-matches.txt', shown.join('\n'));

  if (run) {
    await finishRun(run, {
      status: errors.length >= queries && queries > 0 ? 'failed' : 'ok',
      itemsFound: counts.found, itemsNew: counts.stored, itemsAttached: counts.attached,
      unmatched: counts.unmatched, lowConfidence: counts.lowConfidence,
      errors: errors.slice(0, 40), detail: { members: todo.length, provider: provider.name, searches: queries, filled: filled.length },
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
