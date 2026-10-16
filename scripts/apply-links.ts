/**
 * Writes members' official links and a few profile facts into the admin
 * overrides table, exactly as an editor saving them in /admin would: one
 * override per field, one audit row per change, so each can be seen and
 * reverted from the admin panel. The site picks them up on its next build.
 *
 *   npx tsx scripts/apply-links.ts <results-dir>                    report only
 *   npx tsx scripts/apply-links.ts <results-dir> --apply            write
 *   npx tsx scripts/apply-links.ts <results-dir> --apply --ids a,b  only these members
 *   npx tsx scripts/apply-links.ts <results-dir> --review out.md    write the review list too
 *   --verify-confirmed   a pending Facebook page the research confirmed (its own
 *                        title and description name the member and seat) goes up
 *                        as "verified" too
 *
 * <results-dir> holds JSON files, each an array of
 *   { memberId, links: { facebook|youtube|x|instagram|website: { url, evidence, confirm? } },
 *     fields: { educationBn|birthPlaceBn|professionBn: { value, source } },
 *     remove?: { facebook?: reason, website?: reason }, notes? }
 * as written by the research pass of 2026-10-17 (every item with the page that shows it).
 *
 * What it writes:
 * - A link only when its address belongs to its network (a facebook link on
 *   facebook.com, a website not on a social network or a news site), and only
 *   where the member has none or the found one confirms or corrects a
 *   Facebook page still "pending".
 * - A Facebook page found with evidence goes up as "verified" when the
 *   evidence is the member's own site, Wikipedia or Wikidata, and as
 *   "pending" (shown with "যাচাই করা হয়নি") otherwise.
 * - sourceUrl (the evidence) and lastChecked (today) with any link it writes.
 * - A fact only into a field that is empty, never over an editor's value.
 * - `remove`: a Facebook page shown as someone else's is marked "disputed" (the
 *   page shows no link); a website that is gone is emptied.
 */
import fs from 'node:fs';
import path from 'node:path';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const argOf = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const ACTOR = argOf('actor') ?? 'editorial: official links and profile facts, from cited sources';
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

type Kind = 'facebook' | 'youtube' | 'x' | 'instagram' | 'website';
const KINDS: Kind[] = ['facebook', 'youtube', 'x', 'instagram', 'website'];
const FACTS = ['educationBn', 'birthPlaceBn', 'professionBn'] as const;
const WIKI_FIELDS = new Set<string>(FACTS);

/** The address a link of each kind must have. */
const HOST: Record<Exclude<Kind, 'website'>, RegExp> = {
  facebook: /^(www\.|m\.|web\.)?facebook\.com$/,
  youtube: /^(www\.|m\.)?youtube\.com$/,
  x: /^(www\.)?(x|twitter)\.com$/,
  instagram: /^(www\.)?instagram\.com$/,
};
/** A website is the member's own: not a network, not a news site, not a government or party portal. */
const NOT_A_WEBSITE = /(facebook|youtube|youtu\.be|twitter|x\.com|instagram|tiktok|linkedin|wikipedia|wikidata|parliament\.gov\.bd|\.gov\.bd$|prothomalo|thedailystar|bdnews24|tbsnews|jugantor|samakal|kalerkantho|banglatribune|jagonews24|dhakatribune|bssnews|bd-pratidin|ittefaq|nayadiganta|dailynayadiganta|amarsangbad|deshrupantor|ajkerpatrika|risingbd|somoynews|channel24|ntvbd|jamuna\.tv|archive\.org|bnpbd\.org|jamaat-e-islami|ncpbd)/i;
/** Evidence strong enough to show a Facebook page without "not checked". */
const STRONG = /(wikipedia\.org|wikidata\.org)/i;

function clean(kind: Kind, raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.protocol = 'https:';
  u.hash = '';
  const host = u.hostname.toLowerCase();
  if (kind === 'website') {
    if (NOT_A_WEBSITE.test(host)) return null;
    return u.toString();
  }
  if (!HOST[kind].test(host)) return null;
  // Tracking and share parameters go; a profile.php id stays.
  const id = kind === 'facebook' && u.pathname === '/profile.php' ? u.searchParams.get('id') : null;
  u.search = id ? `?id=${id}` : '';
  if (kind === 'facebook') u.hostname = 'www.facebook.com';
  if (kind === 'x') u.hostname = 'x.com';
  // A post, a photo or a share link is not a page.
  if (/\/(posts|videos|photos|reel|share|status|watch|story\.php|permalink)(\/|$)/i.test(u.pathname)) return null;
  if (u.pathname === '/' || u.pathname === '') return null;
  return u.toString().replace(/\/$/, '');
}
const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase().replace(/^https?:\/\/(www\.|m\.|web\.)?/, '').replace(/\/+$/, '') === b.toLowerCase().replace(/^https?:\/\/(www\.|m\.|web\.)?/, '').replace(/\/+$/, '');

interface Found {
  memberId: string;
  nameBn?: string;
  links?: Partial<Record<Kind, { url: string; evidence?: string; confirm?: boolean }>>;
  fields?: Partial<Record<(typeof FACTS)[number], { value: string; source?: string }>>;
  remove?: { facebook?: string; website?: string };
  notes?: string;
}
interface Member { id: string; slug: string; nameBn: string; bioFromWiki?: string | null; [k: string]: unknown }

async function call(pathAndQuery: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...HEAD, ...(init.headers ?? {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} -> ${res.status} ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  const dir = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!dir) throw new Error('usage: apply-links.ts <results-dir> [--apply] [--ids a,b] [--review out.md] [--actor name]');
  const onlyIds = argOf('ids') ? new Set(argOf('ids')!.split(',')) : null;
  const reviewPath = argOf('review');
  const verifyConfirmed = process.argv.includes('--verify-confirmed');

  const members = new Map((JSON.parse(fs.readFileSync('data/members.json', 'utf8')) as Member[]).map((m) => [m.id, m]));
  // Compare against what the site shows: the snapshot with the saved overrides on top.
  for (let off = 0; ; off += 1000) {
    const rows = (await call(`overrides?entity_type=eq.member&select=entity_id,field,value&order=id&limit=1000&offset=${off}`)) as { entity_id: string; field: string; value: string }[];
    for (const o of rows) { const m = members.get(o.entity_id); if (m) m[o.field] = o.value; }
    if (rows.length < 1000) break;
  }

  const found: Found[] = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => { try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return Array.isArray(j) ? j : []; } catch (e) { console.warn(`skipped ${f}: ${(e as Error).message}`); return []; } })
    .filter((x: Found) => x && x.memberId && (!onlyIds || onlyIds.has(x.memberId)));

  const writes: { memberId: string; field: string; value: string; old: string | null }[] = [];
  const review: string[] = [];
  const rejected: string[] = [];
  for (const f of found) {
    const m = members.get(f.memberId);
    if (!m) { rejected.push(`${f.memberId}: no such member`); continue; }
    const lines: string[] = [];
    const put = (field: string, value: string) => {
      const old = (m[field] as string | null | undefined) ?? null;
      if (old === value) return;
      writes.push({ memberId: m.id, field, value, old });
      m[field] = value;
    };
    let evidenceForLinks: string | null = null;
    for (const kind of KINDS) {
      const l = f.links?.[kind];
      if (!l?.url) continue;
      const url = clean(kind, l.url);
      if (!url) { rejected.push(`${m.slug} ${kind}: ${l.url} (not a ${kind} address)`); continue; }
      if (!l.evidence) { rejected.push(`${m.slug} ${kind}: ${url} (no evidence)`); continue; }
      const have = (m[kind] as string | null | undefined) ?? null;
      if (kind === 'facebook') {
        const status = (m.fbStatus as string | null | undefined) ?? null;
        // A page an editor marked verified, disputed or not to show stays as it is.
        if (have && status === 'verified' && !same(have, url)) { rejected.push(`${m.slug} facebook: ${url} (site has a verified page ${have})`); continue; }
        if (status === 'disputed') { rejected.push(`${m.slug} facebook: ${url} (marked disputed by an editor)`); continue; }
        const strong = STRONG.test(l.evidence) || (!!m.website && l.evidence.includes(new URL(String(m.website)).hostname));
        const nextStatus = strong || (verifyConfirmed && l.confirm === true) ? 'verified' : 'pending';
        if (same(have, url) && (status === nextStatus || status === 'verified')) continue;
        put('facebook', url);
        put('fbStatus', status === 'verified' ? 'verified' : nextStatus);
        lines.push(`  - facebook ${same(have, url) ? '(confirmed)' : have ? `(was ${have})` : '(new)'}: ${url} — ${nextStatus} — ${l.evidence}`);
      } else {
        if (have && !same(have, url)) { rejected.push(`${m.slug} ${kind}: ${url} (site already has ${have})`); continue; }
        if (same(have, url)) continue;
        put(kind, url);
        lines.push(`  - ${kind} (new): ${url} — ${l.evidence}`);
      }
      evidenceForLinks ??= l.evidence;
    }
    if (evidenceForLinks) {
      put('sourceUrl', evidenceForLinks);
      put('lastChecked', TODAY);
    }
    if (f.remove?.facebook && m.facebook) {
      if (m.fbStatus !== 'disputed') {
        put('fbStatus', 'disputed');
        lines.push(`  - facebook hidden (marked disputed): ${m.facebook} — ${f.remove.facebook}`);
      }
    }
    if (f.remove?.website && m.website) {
      lines.push(`  - website removed: ${m.website} — ${f.remove.website}`);
      put('website', '');
    }
    const factsWritten: string[] = [];
    for (const field of FACTS) {
      const fx = f.fields?.[field];
      const value = fx?.value?.trim();
      if (!value) continue;
      if (!fx?.source) { rejected.push(`${m.slug} ${field}: "${value}" (no source)`); continue; }
      const old = (m[field] as string | null | undefined) ?? null;
      if (old && old.trim()) { rejected.push(`${m.slug} ${field}: "${value}" (site already has "${old}")`); continue; }
      put(field, value);
      factsWritten.push(field);
      lines.push(`  - ${field}: ${value} — ${fx.source}`);
    }
    // A field written here is no longer "read from Wikipedia".
    const wiki = String(m.bioFromWiki ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const left = wiki.filter((x) => !(factsWritten.includes(x) && WIKI_FIELDS.has(x)));
    if (left.length !== wiki.length) put('bioFromWiki', left.join(','));
    if (lines.length) review.push(`- **${m.nameBn}** (${m.slug})${f.notes ? ` — note: ${f.notes}` : ''}\n${lines.join('\n')}`);
  }

  const byField = new Map<string, number>();
  for (const w of writes) byField.set(w.field, (byField.get(w.field) ?? 0) + 1);
  console.log(`${found.length} members researched, ${review.length} with something to write, ${writes.length} field changes`);
  for (const [f, n] of [...byField].sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(14)} ${n}`);
  console.log(`${rejected.length} items left out`);
  if (reviewPath) {
    fs.writeFileSync(reviewPath, `# Links and facts to write (${TODAY})\n\n${review.join('\n')}\n\n## Left out\n\n${rejected.map((r) => `- ${r}`).join('\n')}\n`);
    console.log(`review list: ${reviewPath}`);
  }
  if (!apply) {
    console.log('\nnothing written: pass --apply');
    return;
  }

  for (let i = 0; i < writes.length; i += 50) {
    const batch = writes.slice(i, i + 50);
    await call('overrides?on_conflict=entity_type,entity_id,field', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch.map((w) => ({
        entity_type: 'member', entity_id: w.memberId, field: w.field, value: w.value, updated_by: null, updated_at: new Date().toISOString(),
      }))),
    });
    await call('audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(batch.map((w) => ({
        actor: null, actor_email: ACTOR, action: 'override.set', entity_type: 'member', entity_id: w.memberId,
        field: w.field, old_value: w.old, new_value: w.value,
      }))),
    });
    process.stdout.write(`\r  written ${Math.min(i + 50, writes.length)}/${writes.length}`);
  }
  console.log('\ndone');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
