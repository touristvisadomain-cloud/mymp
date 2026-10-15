/**
 * Hides every video that came from a YouTube channel outside
 * config/video-channels.ts.
 *
 * The member video search used to keep whatever YouTube returned for a name,
 * so party pages, fan channels and strangers' uploads sat on members' pages.
 * The collector now keeps only the listed outlets' own channels; this clears
 * what came in before.
 *
 *   npm run feed:hide-channels             report what would be hidden, write nothing
 *   npm run feed:hide-channels -- --apply  hide them
 *
 * Only links the system made and nobody has ruled on are touched: an editor's
 * attachment, a pin or a link already hidden is left as it is. Hidden, not
 * deleted: an editor can show any of them again from the admin.
 */
import fs from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

import { OFFICIAL_CHANNEL_IDS } from '../config/video-channels';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const apply = process.argv.includes('--apply');

interface Video { id: number; channel_id: string | null; outlet_name: string | null }

async function videos(): Promise<Video[]> {
  const all: Video[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_BASE}/rest/v1/feed_items?type=eq.video&select=id,channel_id,outlet_name&order=id.asc&offset=${offset}&limit=1000`, { headers: HEAD });
    if (!res.ok) throw new Error(`feed_items -> ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Video[];
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

async function main() {
  const outside = (await videos()).filter((v) => !v.channel_id || !OFFICIAL_CHANNEL_IDS.has(v.channel_id));
  const byChannel = new Map<string, number>();
  for (const v of outside) byChannel.set(v.outlet_name ?? '?', (byChannel.get(v.outlet_name ?? '?') ?? 0) + 1);

  let links = 0;
  // In slices, so the address stays short; only untouched system links are hidden.
  for (let i = 0; i < outside.length; i += 150) {
    const ids = outside.slice(i, i + 150).map((v) => v.id).join(',');
    const where = `feed_item_id=in.(${ids})&attached_by=eq.system&status=eq.visible&pinned=is.false`;
    if (!apply) {
      const res = await fetch(`${URL_BASE}/rest/v1/feed_item_mps?${where}&select=feed_item_id`, { headers: HEAD });
      if (!res.ok) throw new Error(`feed_item_mps -> ${res.status} ${await res.text()}`);
      links += ((await res.json()) as unknown[]).length;
      continue;
    }
    const res = await fetch(`${URL_BASE}/rest/v1/feed_item_mps?${where}`, {
      method: 'PATCH',
      headers: { ...HEAD, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ status: 'hidden', hidden_by: 'system: feed-hide-channels', hidden_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`hide -> ${res.status} ${await res.text()}`);
    links += ((await res.json()) as unknown[]).length;
  }

  console.log(`videos from channels outside the list  ${outside.length}`);
  console.log(`channels                                ${byChannel.size}`);
  console.log(`member links ${apply ? 'hidden' : 'that would be hidden'}  ${links}`);
  console.log(`largest                                 ${[...byChannel].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k.trim()} ${v}`).join(', ')}`);
  if (!apply) console.log('\nnothing written; run with --apply to hide them');
}

main().catch((e) => { console.error(e); process.exit(1); });
