/**
 * Runs the matcher again over everything already collected.
 *
 * A collector skips an address it has stored before, so a name added after an
 * article was fetched would never reach the member it belongs to: কুমিল্লা-৪ is
 * "মোঃ আবুল হাসনাত" on the parliament roll and হাসনাত আবদুল্লাহ in every
 * headline, and until that spelling existed his stories sat in the table
 * attached to nobody. This walks the stored items and attaches what the
 * matcher now recognises.
 *
 *   npm run feed:rematch            report what would change, write nothing
 *   npm run feed:rematch -- --apply attach them
 *
 * Nothing is removed and no existing attachment is altered, so an editor's
 * decisions — a hidden story, a confirmed one, a pin — survive a rematch.
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
import { attach } from '../src/lib/feed/store';
import { allMembers } from '../src/lib/data';
import { OFFICIAL_CHANNEL_IDS } from '../config/video-channels';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };

interface Item { id: number; type: string; channel_id: string | null; title: string; summary: string | null }

async function page(offset: number, size: number): Promise<Item[]> {
  const res = await fetch(`${URL_BASE}/rest/v1/feed_items?select=id,type,channel_id,title,summary&order=id.asc&offset=${offset}&limit=${size}`, { headers: HEAD });
  if (!res.ok) throw new Error(`feed_items -> ${res.status} ${await res.text()}`);
  return (await res.json()) as Item[];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const index = await buildIndex();
  const nameOf = new Map(allMembers.map((m) => [m.id, m.nameBn]));

  let offset = 0;
  let scanned = 0;
  let attached = 0;
  let low = 0;
  const perMp = new Map<string, number>();
  const samples: string[] = [];

  for (;;) {
    const items = await page(offset, 500);
    if (!items.length) break;
    offset += items.length;
    for (const item of items) {
      scanned++;
      // A video from a channel outside config/video-channels.ts stays off every
      // page (owner, 2026-10-15): the table still holds them, hidden.
      if (item.type === 'video' && !(item.channel_id && OFFICIAL_CHANNEL_IDS.has(item.channel_id))) continue;
      for (const m of matchItem(index, { title: item.title, summary: item.summary })) {
        // `attach` leaves an existing row alone, so only genuinely new links
        // are counted here and an editor's ruling is never overwritten.
        const result = apply
          ? await attach({ itemId: item.id, mpId: m.mpId, score: m.score, lowConfidence: m.lowConfidence, signals: m.signals })
          : ((await hasLink(item.id, m.mpId)) ? 'kept' : 'new');
        if (result !== 'new') continue;
        attached++;
        if (m.lowConfidence) low++;
        perMp.set(m.mpId, (perMp.get(m.mpId) ?? 0) + 1);
        if (samples.length < 15) samples.push(`${nameOf.get(m.mpId) ?? m.mpId}: ${item.title.slice(0, 70)}`);
      }
    }
    process.stdout.write(`\rscanned ${scanned}, new links ${attached}`);
  }

  const top = [...perMp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\n\nitems scanned      ${scanned}`);
  console.log(`new links          ${attached}${apply ? '' : ' (nothing written: pass --apply)'}`);
  console.log(`of those to review ${low}`);
  console.log(`members affected   ${perMp.size}`);
  if (top.length) {
    console.log('\nmost new links:');
    for (const [id, n] of top) console.log(`  ${String(n).padStart(3)}  ${nameOf.get(id) ?? id}`);
  }
  if (samples.length) console.log(`\nfor example:\n${samples.map((s) => `  ${s}`).join('\n')}`);
}

/** Used by the dry run only, so a report cannot count a link that exists. */
async function hasLink(itemId: number, mpId: string): Promise<boolean> {
  const res = await fetch(
    `${URL_BASE}/rest/v1/feed_item_mps?feed_item_id=eq.${itemId}&mp_id=eq.${encodeURIComponent(mpId)}&select=feed_item_id&limit=1`,
    { headers: HEAD },
  );
  if (!res.ok) throw new Error(`feed_item_mps -> ${res.status}`);
  return ((await res.json()) as unknown[]).length > 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
