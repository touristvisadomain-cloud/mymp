import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Unmatched } from '@/lib/posts/sync';

export type EntityType = 'member' | 'seat' | 'party' | 'committee';

export interface EditableField {
  key: string;
  label: string;
  multiline?: boolean;
  url?: boolean;
  group?: string;
  hint?: string;
  /** A date written YYYY-MM-DD, not in the future. */
  date?: boolean;
  /** A whole number within these bounds. */
  number?: { min: number; max: number };
  /** A fixed choice; the value stored is the option's value. */
  options?: { value: string; label: string }[];
}

/** Which fields an admin may override, per entity. Keys are the JSON keys in data/. */
export const EDITABLE: Record<EntityType, EditableField[]> = {
  member: [
    { key: 'nameBn', label: 'নাম (বাংলা)' },
    { key: 'nameEn', label: 'নাম (English)' },
    { key: 'dateOfBirth', label: 'জন্মতারিখ', date: true, hint: 'বছর-মাস-দিন, যেমন 1970-02-03। শুধু নির্ভরযোগ্য সূত্রে নিশ্চিত হলে বদলান।' },
    { key: 'fatherBn', label: 'পিতার নাম (বাংলা)' },
    { key: 'fatherEn', label: 'পিতার নাম (English)' },
    { key: 'motherBn', label: 'মাতার নাম (বাংলা)' },
    { key: 'motherEn', label: 'মাতার নাম (English)' },
    { key: 'termsCount', label: 'মোট কতবার সংসদ সদস্য', number: { min: 1, max: 15 }, hint: 'এবারের মেয়াদসহ মোট সংখ্যা।' },
    { key: 'isFreedomFighter', label: 'বীর মুক্তিযোদ্ধা', options: [{ value: 'false', label: 'না' }, { value: 'true', label: 'হ্যাঁ' }] },
    { key: 'professionBn', label: 'পেশা' },
    { key: 'educationBn', label: 'শিক্ষা', multiline: true, hint: 'প্রতিষ্ঠান ও ডিগ্রি; একাধিক হলে সেমিকোলন (;) দিয়ে আলাদা করুন।' },
    { key: 'birthPlaceBn', label: 'জন্মস্থান' },
    { key: 'partyRoleBn', label: 'দলীয় পদ', hint: 'যেমন চেয়ারম্যান বা মহাসচিব; শুধু নির্ভরযোগ্য সূত্রে নিশ্চিত হলে। পাতার বিবরণে দেখায়।' },
    { key: 'ministryBn', label: 'মন্ত্রণালয়', hint: 'যেমন স্বরাষ্ট্র মন্ত্রণালয়; নিচে সরকারি পদও দিন।' },
    { key: 'govPost', label: 'সরকারি পদ', hint: 'মন্ত্রী, প্রতিমন্ত্রী অথবা উপমন্ত্রী।' },
    { key: 'email', label: 'দাপ্তরিক ইমেইল' },
    { key: 'bioBn', label: 'জীবনী', multiline: true, hint: 'অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন দিন। নিরপেক্ষ ভাষায়, শুধু নিচের সূত্রে পাওয়া তথ্য।' },
    { key: 'bioSources', label: 'জীবনীর সূত্র', multiline: true, hint: 'যে নিবন্ধ বা নথি থেকে জীবনী লেখা, তার পুরো লিংক; একাধিক হলে আলাদা লাইনে। পাতায় জীবনীর নিচে দেখায়।' },
    { key: 'facebook', label: 'Facebook পেজ', url: true, group: 'অফিসিয়াল সোশ্যাল মিডিয়া', hint: 'শুধু সদস্যের নিজের বা তাঁর দপ্তরের নিশ্চিত পেজ। পুরো লিংক দিন, যেমন https://www.facebook.com/…' },
    {
      key: 'fbStatus', label: 'Facebook পেজের অবস্থা',
      options: [
        { value: 'verified', label: 'যাচাই করা (লিংক সাধারণভাবে দেখায়)' },
        { value: 'pending', label: 'যাচাই চলছে (লিংকের পাশে "যাচাই করা হয়নি")' },
        { value: 'disputed', label: 'বিতর্কিত (লিংক দেখায় না)' },
        { value: 'not_found', label: 'পাওয়া যায়নি (কিছুই দেখায় না)' },
      ],
      hint: 'ফাঁকা রাখলে আগের নিয়ম: লিংক থাকলে দেখায়। বিতর্কিত বা পাওয়া যায়নি হলে উপরের লিংক দেখানো হয় না।',
    },
    { key: 'fbType', label: 'Facebook-এর ধরন', options: [{ value: 'page', label: 'পেজ' }, { value: 'profile', label: 'প্রোফাইল' }, { value: 'party_page', label: 'দলের পেজ' }] },
    { key: 'fbUsername', label: 'Facebook ইউজারনেম', hint: 'লিংকের শেষ অংশ নয়, পেজের নিজের ইউজারনেম; যেমন trahmanbnp।' },
    { key: 'fbPageId', label: 'Facebook পেজ আইডি', hint: 'সংখ্যায় লেখা আইডি; হাতে যাচাই করে পরে পূরণ করুন।' },
    { key: 'fbVerified', label: 'Facebook-এর নীল ব্যাজ আছে', options: [{ value: 'true', label: 'হ্যাঁ' }, { value: 'false', label: 'না' }], hint: 'হাতে যাচাই করে পরে পূরণ করুন।' },
    { key: 'sourceUrl', label: 'লিংকগুলোর সূত্র', url: true, hint: 'যে পাতা দেখে পেজ বা ওয়েবসাইট নিশ্চিত করা হয়েছে।' },
    { key: 'lastChecked', label: 'লিংক শেষ যাচাইয়ের তারিখ', date: true },
    { key: 'x', label: 'X (Twitter)', url: true },
    { key: 'youtube', label: 'YouTube চ্যানেল', url: true },
    { key: 'instagram', label: 'Instagram', url: true },
    { key: 'website', label: 'ব্যক্তিগত বা দাপ্তরিক ওয়েবসাইট', url: true },
    { key: 'bioEn', label: 'জীবনী (English)', multiline: true, group: 'ইংরেজি সংস্করণ (English)', hint: 'ইংরেজি পাতায় দেখায়। খালি থাকলে অনুবাদের ফাইল (data/translations/en) থেকে আসে; বাংলাটি বদলালে এটিও হালনাগাদ করুন।' },
    { key: 'educationEn', label: 'শিক্ষা (English)', multiline: true },
    { key: 'birthPlaceEn', label: 'জন্মস্থান (English)' },
    { key: 'professionEn', label: 'পেশা (English)' },
    { key: 'partyRoleEn', label: 'দলীয় পদ (English)' },
    { key: 'ministryEn', label: 'মন্ত্রণালয় (English)' },
  ],
  seat: [
    { key: 'nameBn', label: 'আসনের নাম (বাংলা)' },
    { key: 'nameEn', label: 'আসনের নাম (English)' },
    { key: 'boundaryBn', label: 'এলাকার বিবরণ', multiline: true },
    { key: 'boundaryEn', label: 'এলাকার বিবরণ (English)', multiline: true, group: 'ইংরেজি সংস্করণ (English)', hint: 'ইংরেজি পাতায় দেখায়। খালি থাকলে অনুবাদের ফাইল (data/translations/en) থেকে আসে; বাংলাটি বদলালে এটিও হালনাগাদ করুন।' },
  ],
  party: [
    { key: 'nameBn', label: 'দলের নাম (বাংলা)' },
    { key: 'nameEn', label: 'দলের নাম (English)' },
    { key: 'summaryBn', label: 'সংক্ষিপ্ত পরিচিতি', multiline: true, group: 'দলের পরিচিতি', hint: 'দলের তালিকায় নামের নিচে দেখায়; এক-দুই বাক্য।' },
    { key: 'originBn', label: 'দলের ইতিহাস', multiline: true, hint: 'অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন দিন। নিরপেক্ষ ভাষায়, শুধু নির্ভরযোগ্য সূত্রে পাওয়া তথ্য। দলের পাতার "দলের পরিচিতি" অংশে দেখায়।' },
    { key: 'foundedOn', label: 'প্রতিষ্ঠার তারিখ', hint: 'যেমন 1978-09-01, বা শুধু সাল জানা থাকলে 1978।' },
    { key: 'founderBn', label: 'প্রতিষ্ঠাতা' },
    { key: 'symbolBn', label: 'নির্বাচনী প্রতীক' },
    { key: 'leaderTitleBn', label: 'দলপ্রধানের পদ', hint: 'যেমন চেয়ারম্যান, আমির, আহ্বায়ক বা সভাপতি।' },
    { key: 'leaderNameBn', label: 'দলপ্রধানের নাম' },
    { key: 'secretaryTitleBn', label: 'দ্বিতীয় পদ', hint: 'যেমন মহাসচিব বা সাধারণ সম্পাদক।' },
    { key: 'secretaryNameBn', label: 'দ্বিতীয় পদের নাম' },
    { key: 'headquartersBn', label: 'প্রধান কার্যালয়' },
    { key: 'website', label: 'দলের ওয়েবসাইট', url: true, hint: 'https:// দিয়ে শুরু পুরো লিংক।' },
    { key: 'summaryEn', label: 'সংক্ষিপ্ত পরিচিতি (English)', multiline: true, group: 'ইংরেজি সংস্করণ (English)', hint: 'ইংরেজি পাতায় দেখায়। খালি থাকলে সাইটের নিজের ইংরেজি পরিচিতি দেখায়; বাংলাটি বদলালে এটিও হালনাগাদ করুন।' },
    { key: 'originEn', label: 'দলের ইতিহাস (English)', multiline: true },
    { key: 'founderEn', label: 'প্রতিষ্ঠাতা (English)' },
    { key: 'symbolEn', label: 'নির্বাচনী প্রতীক (English)' },
    { key: 'leaderTitleEn', label: 'দলপ্রধানের পদ (English)' },
    { key: 'leaderNameEn', label: 'দলপ্রধানের নাম (English)' },
    { key: 'secretaryTitleEn', label: 'দ্বিতীয় পদ (English)' },
    { key: 'secretaryNameEn', label: 'দ্বিতীয় পদের নাম (English)' },
    { key: 'headquartersEn', label: 'প্রধান কার্যালয় (English)' },
  ],
  committee: [
    { key: 'nameBn', label: 'কমিটির নাম (বাংলা)' },
    { key: 'nameEn', label: 'কমিটির নাম (English)' },
  ],
};

export interface Override {
  entity_type: EntityType;
  entity_id: string;
  field: string;
  value: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface Hidden {
  entity_type: 'member' | 'committee';
  entity_id: string;
  reason: string | null;
  hidden_at: string;
}

export interface NewsRow {
  id: string;
  title_bn: string;
  source_name: string;
  source_url: string;
  published_on: string;
  excerpt_bn: string | null;
  member_id: string | null;
  seat_slug: string | null;
  status: 'draft' | 'published' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface CorrectionRow {
  id: string;
  page_path: string;
  message: string;
  reporter_name: string | null;
  reporter_email: string | null;
  status: 'open' | 'accepted' | 'rejected';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface SyncRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  members: number | null;
  committees: number | null;
  overrides_applied: number | null;
  message: string | null;
}

export interface AdminUserRow {
  user_id: string;
  email: string;
  role: 'super_admin' | 'editor';
  created_at: string;
}

export interface Actor { id: string; email: string }

/**
 * A write Supabase refused comes back as { error }, not as a throw, so every
 * write here is checked: an editor must never see "saved", or an audit row
 * record a change, that the database did not keep.
 */
function must(res: { error: { message: string } | null }, what: string) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
}

export async function audit(a: Actor, entry: Omit<AuditRow, 'id' | 'actor_email' | 'created_at'>) {
  must(await supabaseAdmin().from('audit_log').insert({ actor: a.id, actor_email: a.email, ...entry }), 'the change could not be recorded');
}

/* ---------------- overrides ---------------- */

export async function overridesFor(type: EntityType, id: string): Promise<Override[]> {
  const { data } = await supabaseAdmin()
    .from('overrides').select('*').eq('entity_type', type).eq('entity_id', id);
  return (data ?? []) as Override[];
}

// Supabase answers at most 1000 rows to one request and says nothing about the
// rest, so counts are asked for as counts and long lists are read a page at a time.

export async function overrideCounts(): Promise<Record<EntityType, number>> {
  const types: EntityType[] = ['member', 'seat', 'party', 'committee'];
  const counts = await Promise.all(types.map(async (t) => {
    const { count } = await supabaseAdmin().from('overrides').select('*', { count: 'exact', head: true }).eq('entity_type', t);
    return count ?? 0;
  }));
  return Object.fromEntries(types.map((t, i) => [t, counts[i]])) as Record<EntityType, number>;
}

/** Every id of this type that has at least one hand-edited field. */
export async function editedIds(type: EntityType): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin().from('overrides').select('entity_id').eq('entity_type', type)
      .order('entity_id').order('field').range(from, from + 999);
    for (const r of data ?? []) out.add(r.entity_id as string);
    if ((data ?? []).length < 1000) return out;
  }
}

/** Current social-link overrides for a set of members: id → field → value. */
export async function socialOverrides(ids: string[]): Promise<Map<string, Record<string, string | null>>> {
  const out = new Map<string, Record<string, string | null>>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabaseAdmin()
      .from('overrides')
      .select('entity_id,field,value')
      .eq('entity_type', 'member')
      .in('entity_id', ids.slice(i, i + 100))
      .in('field', ['facebook', 'x', 'youtube', 'instagram', 'website']);
    for (const r of data ?? []) out.set(r.entity_id, { ...(out.get(r.entity_id) ?? {}), [r.field]: r.value });
  }
  return out;
}

export async function setOverride(a: Actor, type: EntityType, id: string, field: string, value: string | null, oldValue: string | null) {
  if (!EDITABLE[type].some((f) => f.key === field) && !(type === 'member' && field === 'bioFromWiki')) throw new Error(`Field ${field} is not editable on ${type}.`);
  const db = supabaseAdmin();
  must(await db.from('overrides').upsert(
    { entity_type: type, entity_id: id, field, value, updated_by: a.id, updated_at: new Date().toISOString() },
    { onConflict: 'entity_type,entity_id,field' },
  ), `${field} could not be saved`);
  await audit(a, { action: 'override.set', entity_type: type, entity_id: id, field, old_value: oldValue, new_value: value });
}

/**
 * Once an editor saves a member's links, they are the editor's: the note that
 * the engine read them from Wikipedia is dropped (and the drop audited).
 */
export async function dropSocialSource(a: Actor, id: string) {
  const { data } = await supabaseAdmin()
    .from('overrides').select('value').match({ entity_type: 'member', entity_id: id, field: 'socialSource' }).maybeSingle();
  if (data) await clearOverride(a, 'member', id, 'socialSource', (data.value as string | null) ?? null);
}

/**
 * Once an editor saves education, birthplace or profession, that field is the
 * editor's: it leaves the list of fields shown as read from Wikipedia.
 */
export async function dropBioFromWiki(a: Actor, id: string, fields: string[]) {
  const { data } = await supabaseAdmin()
    .from('overrides').select('value').match({ entity_type: 'member', entity_id: id, field: 'bioFromWiki' }).maybeSingle();
  if (!data?.value) return;
  const before = String(data.value);
  const left = before.split(',').map((x) => x.trim()).filter((x) => x && !fields.includes(x));
  if (left.length) await setOverride(a, 'member', id, 'bioFromWiki', left.join(','), before);
  else await clearOverride(a, 'member', id, 'bioFromWiki', before);
}

export async function clearOverride(a: Actor, type: EntityType, id: string, field: string, oldValue: string | null) {
  must(await supabaseAdmin().from('overrides').delete().match({ entity_type: type, entity_id: id, field }), `${field} could not be reverted`);
  await audit(a, { action: 'override.clear', entity_type: type, entity_id: id, field, old_value: oldValue, new_value: null });
}

/* ---------------- hidden ---------------- */

export async function hiddenList(): Promise<Hidden[]> {
  const { data } = await supabaseAdmin().from('hidden_entities').select('*');
  return (data ?? []) as Hidden[];
}

export async function isHidden(type: 'member' | 'committee', id: string): Promise<Hidden | null> {
  const { data } = await supabaseAdmin().from('hidden_entities').select('*').match({ entity_type: type, entity_id: id }).maybeSingle();
  return (data as Hidden | null) ?? null;
}

export async function setHidden(a: Actor, type: 'member' | 'committee', id: string, hidden: boolean, reason: string | null) {
  const db = supabaseAdmin();
  if (hidden) {
    must(await db.from('hidden_entities').upsert({ entity_type: type, entity_id: id, reason, hidden_by: a.id, hidden_at: new Date().toISOString() }), 'could not hide');
  } else {
    must(await db.from('hidden_entities').delete().match({ entity_type: type, entity_id: id }), 'could not show again');
  }
  await audit(a, { action: hidden ? 'entity.hide' : 'entity.unhide', entity_type: type, entity_id: id, field: null, old_value: null, new_value: reason });
}

/* ---------------- news ---------------- */

export async function listNews(status?: NewsRow['status']): Promise<NewsRow[]> {
  let q = supabaseAdmin().from('news_posts').select('*').order('published_on', { ascending: false }).limit(300);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data ?? []) as NewsRow[];
}

export async function getNews(id: string): Promise<NewsRow | null> {
  const { data } = await supabaseAdmin().from('news_posts').select('*').eq('id', id).maybeSingle();
  return (data as NewsRow | null) ?? null;
}

export type NewsInput = Pick<NewsRow, 'title_bn' | 'source_name' | 'source_url' | 'published_on' | 'excerpt_bn' | 'member_id' | 'seat_slug'>;

export async function upsertNews(a: Actor, id: string | null, input: NewsInput): Promise<string> {
  const db = supabaseAdmin();
  if (id) {
    const before = await getNews(id);
    // A reworded headline or excerpt is translated again (supabase/migrations/006); the
    // columns are cleared only where the migration has added them.
    const reworded = before && (before.title_bn !== input.title_bn || (before.excerpt_bn ?? null) !== (input.excerpt_bn ?? null));
    const english = reworded && 'title_en' in before ? { title_en: null, excerpt_en: null, en_source: null, en_at: null } : {};
    must(await db.from('news_posts').update({ ...input, ...english, updated_by: a.id, updated_at: new Date().toISOString() }).eq('id', id), 'the news post could not be saved');
    await audit(a, { action: 'news.update', entity_type: 'news', entity_id: id, field: null, old_value: before?.title_bn ?? null, new_value: input.title_bn });
    return id;
  }
  const { data, error } = await db.from('news_posts').insert({ ...input, created_by: a.id, updated_by: a.id }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  await audit(a, { action: 'news.create', entity_type: 'news', entity_id: data.id, field: null, old_value: null, new_value: input.title_bn });
  return data.id as string;
}

export async function setNewsStatus(a: Actor, id: string, status: NewsRow['status']) {
  const before = await getNews(id);
  must(await supabaseAdmin().from('news_posts').update({ status, updated_by: a.id, updated_at: new Date().toISOString() }).eq('id', id), 'the status could not be changed');
  await audit(a, { action: `news.${status}`, entity_type: 'news', entity_id: id, field: 'status', old_value: before?.status ?? null, new_value: status });
}

/* ---------------- corrections ---------------- */

export async function listCorrections(status?: CorrectionRow['status']): Promise<CorrectionRow[]> {
  let q = supabaseAdmin().from('corrections').select('*').order('created_at', { ascending: false }).limit(300);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data ?? []) as CorrectionRow[];
}

export async function resolveCorrection(a: Actor, id: string, status: 'accepted' | 'rejected', note: string | null) {
  must(await supabaseAdmin().from('corrections').update({ status, resolution_note: note, resolved_by: a.id, resolved_at: new Date().toISOString() }).eq('id', id), 'the correction could not be resolved');
  await audit(a, { action: 'correction.resolve', entity_type: 'correction', entity_id: id, field: 'status', old_value: 'open', new_value: status });
}

/* ---------------- audit / sync / users ---------------- */

/** The audit log filtered in the database, a page at a time, newest first. */
export async function searchAudit(q: { entity?: string; type?: string; actor?: string; action?: string; from: number; limit: number }): Promise<{ rows: AuditRow[]; total: number }> {
  let query = supabaseAdmin().from('audit_log').select('*', { count: 'exact' });
  if (q.entity) query = query.eq('entity_id', q.entity.trim());
  if (q.type) query = query.eq('entity_type', q.type);
  // PostgREST's ilike pattern: % and _ in what the editor typed are taken literally.
  const literal = (s: string) => s.trim().replace(/[%_,()]/g, (c) => `\\${c}`);
  if (q.actor) query = query.ilike('actor_email', `%${literal(q.actor)}%`);
  if (q.action) query = query.ilike('action', `%${literal(q.action)}%`);
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(q.from, q.from + q.limit - 1);
  if (error) throw new Error(`the history could not be read: ${error.message}`);
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

export async function listAudit(limit = 100): Promise<AuditRow[]> {
  const { data } = await supabaseAdmin().from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as AuditRow[];
}

export async function listSyncRuns(limit = 30): Promise<SyncRunRow[]> {
  const { data } = await supabaseAdmin().from('sync_runs').select('*').order('started_at', { ascending: false }).limit(limit);
  return (data ?? []) as SyncRunRow[];
}

export async function listAdmins(): Promise<AdminUserRow[]> {
  const { data } = await supabaseAdmin().from('admin_users').select('*').order('created_at');
  return (data ?? []) as AdminUserRow[];
}

/** Creates the auth user (if new) and the admin row. Returns the temporary password when a user was created. */
export async function addAdmin(a: Actor, email: string, role: AdminUserRow['role']): Promise<{ tempPassword: string | null }> {
  const db = supabaseAdmin();
  const clean = email.trim().toLowerCase();
  let userId: string | null = null;
  let tempPassword: string | null = null;

  const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users.find((u) => (u.email ?? '').toLowerCase() === clean);
  if (found) {
    userId = found.id;
  } else {
    tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    const { data: created, error } = await db.auth.admin.createUser({ email: clean, password: tempPassword, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? 'could not create user');
    userId = created.user.id;
  }

  if (userId === a.id) throw new Error('নিজের ভূমিকা এখান থেকে বদলানো যায় না। অন্য একজন সুপার অ্যাডমিনকে বলুন।');
  const { data: before } = await db.from('admin_users').select('role').eq('user_id', userId).maybeSingle();
  must(await db.from('admin_users').upsert({ user_id: userId, email: clean, role }), 'the admin could not be saved');
  await audit(a, { action: 'user.add', entity_type: 'admin_user', entity_id: userId, field: 'role', old_value: (before?.role as string | undefined) ?? null, new_value: role });
  return { tempPassword };
}

export async function removeAdmin(a: Actor, userId: string) {
  const { data: row } = await supabaseAdmin().from('admin_users').select('email, role').eq('user_id', userId).maybeSingle();
  if (row?.role === 'super_admin') {
    const { count } = await supabaseAdmin().from('admin_users').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if ((count ?? 0) <= 1) throw new Error('শেষ সুপার অ্যাডমিনকে সরানো যায় না; আগে আরেকজনকে সুপার অ্যাডমিন করুন।');
  }
  must(await supabaseAdmin().from('admin_users').delete().eq('user_id', userId), 'the admin could not be removed');
  await audit(a, { action: 'user.remove', entity_type: 'admin_user', entity_id: userId, field: null, old_value: row ? `${row.email} (${row.role})` : null, new_value: null });
}

export async function counts() {
  const db = supabaseAdmin();
  const c = async (table: string, filter?: [string, string]) => {
    let q = db.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count } = await q;
    return count ?? 0;
  };
  return {
    overrides: await c('overrides'),
    hidden: await c('hidden_entities'),
    newsDraft: await c('news_posts', ['status', 'draft']),
    newsPublished: await c('news_posts', ['status', 'published']),
    correctionsOpen: await c('corrections', ['status', 'open']),
    admins: await c('admin_users'),
  };
}

/* ---------------- election results (entered from the EC gazette) ---------------- */

export interface ResultRow {
  id: string;
  seat_no: number;
  parliament_no: number;
  candidates: { name: string; party: string | null; votes: number }[];
  total_votes: number | null;
  turnout: number | null;
  source_url: string;
  source_note: string | null;
  status: 'draft' | 'published';
  updated_at: string;
}

export async function listResults(): Promise<ResultRow[]> {
  // Every seat of every election: past 1000 rows as soon as a second election is entered.
  const out: ResultRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin()
      .from('election_results')
      .select('id,seat_no,parliament_no,candidates,total_votes,turnout,source_url,source_note,status,updated_at')
      .order('seat_no')
      .order('parliament_no', { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as ResultRow[]));
    if ((data ?? []).length < 1000) return out;
  }
}

export async function getResult(seatNo: number, parliamentNo: number): Promise<ResultRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('election_results')
    .select('id,seat_no,parliament_no,candidates,total_votes,turnout,source_url,source_note,status,updated_at')
    .eq('seat_no', seatNo)
    .eq('parliament_no', parliamentNo)
    .maybeSingle();
  if (error) throw error;
  return (data as ResultRow | null) ?? null;
}

export async function upsertResult(a: Actor, input: Omit<ResultRow, 'id' | 'updated_at'>) {
  const db = supabaseAdmin();
  const { error } = await db
    .from('election_results')
    .upsert({ ...input, updated_by: a.id, updated_at: new Date().toISOString() }, { onConflict: 'seat_no,parliament_no' });
  if (error) throw error;
  await audit(a, {
    action: 'result.save', entity_type: 'seat', entity_id: String(input.seat_no), field: `parliament ${input.parliament_no}`,
    old_value: null, new_value: `${input.candidates.length} candidates, ${input.status}`,
  });
}

export async function setResultStatus(a: Actor, seatNo: number, parliamentNo: number, status: ResultRow['status']) {
  const { error } = await supabaseAdmin()
    .from('election_results')
    .update({ status, updated_by: a.id, updated_at: new Date().toISOString() })
    .eq('seat_no', seatNo)
    .eq('parliament_no', parliamentNo);
  if (error) throw error;
  await audit(a, { action: `result.${status}`, entity_type: 'seat', entity_id: String(seatNo), field: `parliament ${parliamentNo}`, old_value: null, new_value: status });
}

/* ---------------- government posts sync ---------------- */

export interface PostRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'ok' | 'failed';
  trigger: string | null;
  parsed: number | null;
  added: number;
  closed: number;
  unchanged: number;
  unmatched: number;
  unmatched_names: Unmatched[] | null;
  changes: { kind: string; title: string; ministry_bn: string | null; name_bn: string; member_id: string | null }[] | null;
  errors: { source: string; message: string }[] | null;
  source_counts: Record<string, number> | null;
}

export interface PostAliasRow {
  name_key: string;
  name_bn: string;
  member_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** `missing` when supabase/migrations/003_posts.sql has not been run yet. */
export async function listPostRuns(limit = 30): Promise<{ runs: PostRunRow[]; missing: boolean }> {
  const { data, error } = await supabaseAdmin().from('post_sync_runs').select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) return { runs: [], missing: true };
  return { runs: (data ?? []) as PostRunRow[], missing: false };
}

export async function listPostAliases(): Promise<PostAliasRow[]> {
  const { data } = await supabaseAdmin().from('post_aliases').select('*').order('created_at', { ascending: false });
  return (data ?? []) as PostAliasRow[];
}

/** Remembers who a listed name is; the posts sync reads it on every run. memberId null: not an MP. */
export async function setPostAlias(a: Actor, nameKey: string, nameBn: string, memberId: string | null) {
  const { error } = await supabaseAdmin()
    .from('post_aliases')
    .upsert({ name_key: nameKey, name_bn: nameBn, member_id: memberId, created_by: a.email, created_at: new Date().toISOString() }, { onConflict: 'name_key' });
  if (error) throw error;
  await audit(a, { action: 'posts.alias', entity_type: 'post_alias', entity_id: nameKey, field: null, old_value: null, new_value: memberId ?? 'not an MP' });
}
