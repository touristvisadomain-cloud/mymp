/**
 * Runs the matcher again over what it attached, and hides what it would no
 * longer attach.
 *
 * The counterpart of feed-rematch, which only adds. When the matcher learns
 * to reject something (a DBC video on the Houthi leader Abdul Malik al-Houthi
 * sat on the page of the member আব্দুল মালিক), the old links stay until this
 * runs.
 *
 *   npm run feed:prune             report what would be hidden, write nothing
 *   npm run feed:prune -- --apply  hide them
 *   npm run feed:prune -- --all    judge by every current rule, not only the
 *                                  longer-name one (owner, 2026-10-15: a page
 *                                  shows only that member's own news)
 *
 * Only links the system made and nobody has ruled on are touched: an editor's
 * attachment, a confirmed story, a pin or a hidden one is left as it is.
 * Hidden, not deleted: an editor can show any of them again from the admin.
 */
import fs from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

import { buildIndex } from '../src/lib/feed/collect';
import { matchItem } from '../src/lib/feed/matchMp';
import { allMembers } from '../src/lib/data';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

interface Link {
  feed_item_id: number;
  mp_id: string;
  pinned: boolean;
  signals: { signal: string }[] | null;
  feed_items: { title: string; summary: string | null; type: string } | null;
}

async function page(offset: number, size: number): Promise<Link[]> {
  const res = await fetch(
    `${URL_BASE}/rest/v1/feed_item_mps?attached_by=eq.system&status=eq.visible&pinned=is.false` +
      `&select=feed_item_id,mp_id,pinned,signals,feed_items(title,summary,type)&order=feed_item_id.asc,mp_id.asc&offset=${offset}&limit=${size}`,
    { headers: HEAD },
  );
  if (!res.ok) throw new Error(`feed_item_mps -> ${res.status} ${await res.text()}`);
  return (await res.json()) as Link[];
}

async function hide(link: Link) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/feed_item_mps?feed_item_id=eq.${link.feed_item_id}&mp_id=eq.${encodeURIComponent(link.mp_id)}&attached_by=eq.system&status=eq.visible`,
    {
      method: 'PATCH',
      headers: { ...HEAD, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'hidden',
        hidden_by: 'system: feed-prune',
        hidden_at: new Date().toISOString(),
        hide_reason: 'The matcher no longer names this member in the story (feed-prune).',
      }),
    },
  );
  if (!res.ok) throw new Error(`hide ${link.feed_item_id}/${link.mp_id} -> ${res.status} ${await res.text()}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allRules = process.argv.includes('--all');
  const index = await buildIndex();
  const nameOf = new Map(allMembers.map((m) => [m.id, m.nameBn]));

  // Everything is read before anything is hidden, so paging is not disturbed
  // by rows leaving the filter underneath it.
  const links: Link[] = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = await page(offset, 1000);
    links.push(...batch);
    process.stdout.write(`\rread ${links.length}`);
    if (batch.length < 1000) break;
  }

  const stale: Link[] = [];
  const cache = new Map<number, { now: Set<string>; before: Set<string> }>();
  for (const link of links) {
    const item = link.feed_items;
    if (!item) continue;
    // A parliament notice names its member in the notice itself, not by
    // matching, so it is never re-judged here.
    if ((link.signals ?? []).some((g) => g.signal === 'parliament-notice')) continue;
    let ids = cache.get(link.feed_item_id);
    if (!ids) {
      const text = { title: item.title, summary: item.summary };
      ids = {
        now: new Set(matchItem(index, text).map((m) => m.mpId)),
        before: new Set(matchItem(index, text, { longerNames: false }).map((m) => m.mpId)),
      };
      cache.set(link.feed_item_id, ids);
    }
    // Hidden only when the new rules are what reject it: a link some older,
    // looser scoring made and today's scores would not is an editor's call.
    if (!ids.now.has(link.mp_id) && (allRules || ids.before.has(link.mp_id))) stale.push(link);
  }

  console.log(`\n\nlinks checked   ${links.length}`);
  console.log(`no longer match ${stale.length}${apply ? '' : ' (nothing written: pass --apply)'}`);
  const perMp = new Map<string, number>();
  for (const s of stale) perMp.set(s.mp_id, (perMp.get(s.mp_id) ?? 0) + 1);
  for (const [id, n] of [...perMp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(4)}  ${nameOf.get(id) ?? id}`);
  }
  console.log('\nall of them:');
  for (const s of stale) {
    const now = [...(cache.get(s.feed_item_id)?.now ?? [])].map((id) => nameOf.get(id) ?? id).join(', ') || 'nobody';
    console.log(`  ${nameOf.get(s.mp_id) ?? s.mp_id} -> ${now} | ${s.feed_items?.title.slice(0, 70)}`);
  }

  if (apply) {
    let done = 0;
    for (const s of stale) {
      await hide(s);
      done++;
    }
    console.log(`\nhidden ${done}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
