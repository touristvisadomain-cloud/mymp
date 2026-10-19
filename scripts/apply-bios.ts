/**
 * Writes members' biographies into the admin overrides table, exactly as an
 * editor saving them in /admin would: one override per field, one audit row per
 * change, so each can be seen and reverted from the admin panel.
 *
 *   npx tsx scripts/apply-bios.ts <bios-dir>                        report only
 *   npx tsx scripts/apply-bios.ts <bios-dir> --apply                write
 *   npx tsx scripts/apply-bios.ts <bios-dir> --apply --ids a,b,c    only these members
 *   npx tsx scripts/apply-bios.ts <bios-dir> --apply --actor "..."  the name in the audit log
 *
 * Used for the cabinet on 2026-09-16, then for every other member.
 *
 * <bios-dir> holds one JSON file per member: { memberId, bioBn, fields, sources }.
 * The site picks the overrides up on its next build.
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

const ALLOWED = new Set(['bioBn', 'bioSources', 'professionBn', 'educationBn', 'birthPlaceBn', 'partyRoleBn', 'dutiesBn', 'dutiesSources']);
const WIKI_FIELDS = new Set(['educationBn', 'birthPlaceBn', 'professionBn']);
const argOf = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const ACTOR = argOf('actor') ?? 'editorial: member profiles, written from cited sources';
/** The site's own page is where a reader already is, not a source. */
const isOwnPage = (u: string) => /^https?:\/\/(www\.)?mymp\.bd\//.test(u);

interface Bio { memberId: string; bioBn: string; fields?: Record<string, string>; sources: string[] }
interface Member { id: string; nameBn: string; bioFromWiki?: string | null; [k: string]: unknown }

async function call(pathAndQuery: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...HEAD, ...(init.headers ?? {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} -> ${res.status} ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  const dir = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!dir) throw new Error('usage: apply-bios.ts <bios-dir> [--apply] [--ids a,b] [--actor name]');
  const onlyIds = argOf('ids') ? new Set(argOf('ids')!.split(',')) : null;

  const members = new Map((JSON.parse(fs.readFileSync('data/members.json', 'utf8')) as Member[]).map((m) => [m.id, m]));
  // Compare against what the site shows: the snapshot with the saved overrides on top.
  for (let off = 0; ; off += 1000) {
    const rows = (await call(`overrides?entity_type=eq.member&select=entity_id,field,value&order=id&limit=1000&offset=${off}`)) as { entity_id: string; field: string; value: string }[];
    for (const o of rows) { const m = members.get(o.entity_id); if (m) m[o.field] = o.value; }
    if (rows.length < 1000) break;
  }
  const bios = fs.readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Bio)
    .filter((b) => !onlyIds || onlyIds.has(b.memberId))
    .map((b) => ({ ...b, fields: b.fields ?? {}, sources: (b.sources ?? []).filter((u) => !isOwnPage(u)) }));

  const writes: { memberId: string; field: string; value: string; old: string | null }[] = [];
  for (const b of bios) {
    const m = members.get(b.memberId);
    if (!m) throw new Error(`no member ${b.memberId}`);
    if (!b.bioBn?.trim() || !b.sources?.length) throw new Error(`${b.memberId}: a biography needs text and sources`);

    const values: Record<string, string> = { bioBn: b.bioBn.trim(), bioSources: b.sources.join('\n'), ...b.fields };
    for (const [field, value] of Object.entries(values)) {
      if (!ALLOWED.has(field)) throw new Error(`${b.memberId}: field ${field} is not one this script writes`);
      const old = (m[field] as string | null | undefined) ?? null;
      if (old === value) continue;
      writes.push({ memberId: b.memberId, field, value, old });
    }

    // A field an editor has written is no longer "read from Wikipedia", so its
    // asterisk goes, as the admin panel does when a person saves it.
    const wiki = (m.bioFromWiki ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const left = wiki.filter((f) => !(f in b.fields && WIKI_FIELDS.has(f)));
    if (left.length !== wiki.length) {
      writes.push({ memberId: b.memberId, field: 'bioFromWiki', value: left.join(','), old: m.bioFromWiki ?? null });
    }
  }

  const byField = new Map<string, number>();
  for (const w of writes) byField.set(w.field, (byField.get(w.field) ?? 0) + 1);
  console.log(`${bios.length} biographies, ${writes.length} field changes`);
  for (const [f, n] of byField) console.log(`  ${f.padEnd(14)} ${n}`);
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
