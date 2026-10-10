'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseSession } from '@/lib/supabase/server';
import { requireAdmin, requireSuperAdmin } from '@/lib/admin/auth';
import {
  EDITABLE, type EntityType, setOverride, clearOverride, setHidden, overridesFor,
  upsertNews, setNewsStatus, resolveCorrection, addAdmin, removeAdmin, audit,
  upsertResult, setResultStatus, socialOverrides, dropSocialSource, dropBioFromWiki, setPostAlias,
} from '@/lib/admin/store';
import { runPostsSync } from '@/lib/posts/sync';
import { requestRebuild } from '@/lib/rebuild';
import { runRssCollector } from '@/lib/feed/collect';
import { upsertItem } from '@/lib/feed/store';
import { fetchItemForUrl } from '@/lib/feed/fetchItem';
import { variantTokens } from '@/lib/feed/matchMp';
import {
  setAttachmentStatus, confirmAttachment, setPinned, attachByHand, bulkHide, addVariant, removeVariant,
} from '@/lib/admin/feed';
import { SOCIAL_HOSTS, validSocialUrl, parseSocialLines } from '@/lib/admin/social-import';
import { allMembers } from '@/lib/data';
import { allQuestions } from '@/lib/admin/questions';

export interface ActionState { error?: string; ok?: string }

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
};
const orNull = (s: string) => (s.trim() === '' ? null : s.trim());

const validUrl = validSocialUrl;

/** YYYY-MM-DD that is a real calendar day, after 1900 and not in the future. */
const validPastDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
};

/* ---------------- session ---------------- */

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email').trim().toLowerCase();
  const password = str(fd, 'password');
  if (!email || !password) return { error: 'ইমেইল ও পাসওয়ার্ড দুটোই লাগবে।' };
  const sb = await supabaseSession();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: 'ইমেইল বা পাসওয়ার্ড মেলেনি।' };
  redirect('/admin');
}

export async function signOut() {
  const sb = await supabaseSession();
  await sb.auth.signOut();
  redirect('/admin/login');
}

/** Change the signed-in admin's own password. Runs against their session, not the service key. */
export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const password = str(fd, 'password');
  const confirm = str(fd, 'confirm');
  if (password.length < 10) return { error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' };
  if (password !== confirm) return { error: 'দুই ঘরের পাসওয়ার্ড মেলেনি।' };
  const sb = await supabaseSession();
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: `বদলানো যায়নি: ${error.message}` };
  await audit(me, { action: 'user.password', entity_type: 'admin_user', entity_id: me.id, field: null, old_value: null, new_value: null });
  return { ok: 'পাসওয়ার্ড বদলে গেছে। পরের বার থেকে নতুনটি দিয়ে লগইন করুন।' };
}

/* ---------------- overrides ---------------- */

/**
 * Saves every field on the form that differs from what the site currently
 * shows. Each changed field becomes its own override row and audit entry, so a
 * later revert can be done per field.
 */
const ADMIN_PATH: Record<EntityType, string> = { member: 'members', seat: 'seats', party: 'parties', committee: 'committees' };

export async function saveOverrides(fd: FormData) {
  const me = await requireAdmin();
  const type = str(fd, 'entity_type') as EntityType;
  const id = str(fd, 'entity_id');
  if (!EDITABLE[type] || !id) throw new Error('bad entity');

  const invalid: string[] = [];
  const conflict: string[] = [];
  let socialSaved = false;
  const bioSaved: string[] = [];
  // Someone else may have saved this record since the form was opened.
  const loadedAt = str(fd, 'loaded_at');
  const stored = new Map((await overridesFor(type, id)).map((o) => [o.field, o]));
  for (const f of EDITABLE[type]) {
    const next = orNull(str(fd, `field__${f.key}`));
    const current = orNull(str(fd, `current__${f.key}`));
    if (next === current) continue;
    const theirs = stored.get(f.key);
    if (theirs && loadedAt && new Date(theirs.updated_at).getTime() > Date.parse(loadedAt) && theirs.value !== next) {
      conflict.push(f.key);
      continue;
    }
    if (type === 'member' && next && f.key in SOCIAL_HOSTS && !validUrl(next, SOCIAL_HOSTS[f.key as keyof typeof SOCIAL_HOSTS])) {
      invalid.push(f.key);
      continue;
    }
    // Any other link field (a party's website) must at least be a full https address.
    if (type !== 'member' && f.url && next && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(next)) {
      invalid.push(f.key);
      continue;
    }
    // A date, a number or a choice must be one the site can read, or the page breaks.
    if (next && f.date && !validPastDate(next)) { invalid.push(f.key); continue; }
    if (next && f.number && !(/^\d+$/.test(next) && +next >= f.number.min && +next <= f.number.max)) { invalid.push(f.key); continue; }
    if (next && f.options && !f.options.some((o) => o.value === next)) { invalid.push(f.key); continue; }
    // Keep a pasted biography or name inside what a page can show.
    if (next && next.length > (f.multiline ? 20_000 : 500)) { invalid.push(f.key); continue; }
    await setOverride(me, type, id, f.key, next, current ?? theirs?.value ?? null);
    if (f.key in SOCIAL_HOSTS) socialSaved = true;
    if (['educationBn', 'birthPlaceBn', 'professionBn'].includes(f.key)) bioSaved.push(f.key);
  }
  if (type === 'member' && bioSaved.length) await dropBioFromWiki(me, id, bioSaved);
  // The editor has now seen and saved this member's links on one form.
  if (type === 'member' && socialSaved) await dropSocialSource(me, id);
  // "party" + "s" is not the route: parties live at /admin/parties.
  const page = `/admin/${ADMIN_PATH[type]}/${id}`;
  revalidatePath(page);
  const flags = new URLSearchParams({
    ...(invalid.length ? { invalid: invalid.join(',') } : {}),
    ...(conflict.length ? { conflict: conflict.join(',') } : {}),
  });
  redirect(`${page}?${flags.size ? flags : 'saved=1'}`);
}

export interface SocialImportState {
  error?: string;
  saved?: number;
  unchanged?: number;
  lines?: { line: number; raw: string; who?: string; ok: boolean; message: string }[];
}

/**
 * Many members' social links at once. Each changed link becomes its own
 * override and audit entry, exactly as if it had been typed on the member's
 * page; lines that cannot be read are reported and nothing is guessed.
 */
export async function importSocialLinks(_prev: SocialImportState, fd: FormData): Promise<SocialImportState> {
  const me = await requireAdmin();
  const text = str(fd, 'lines');
  if (!text.trim()) return { error: 'কোনো লাইন দেওয়া হয়নি।' };
  const parsed = parseSocialLines(text, allMembers);
  const ids = [...new Set(parsed.filter((p) => !p.error && p.memberId).map((p) => p.memberId!))];
  const current = await socialOverrides(ids);
  const byId = new Map(allMembers.map((m) => [m.id, m]));
  let saved = 0;
  let unchanged = 0;
  const lines: NonNullable<SocialImportState['lines']> = [];
  const label: Record<string, string> = { facebook: 'Facebook', x: 'X', youtube: 'YouTube', instagram: 'Instagram', website: 'ওয়েবসাইট' };
  for (const p of parsed) {
    if (p.error || !p.memberId) {
      lines.push({ line: p.line, raw: p.raw, ok: false, message: p.error ?? 'পড়া যায়নি' });
      continue;
    }
    const shown = byId.get(p.memberId) as unknown as Record<string, string | null> | undefined;
    const changed: string[] = [];
    for (const l of p.links) {
      const own = current.get(p.memberId);
      const before = own && l.key in own ? (own[l.key] ?? null) : (shown?.[l.key] ?? null);
      if (before === l.url) {
        unchanged++;
        continue;
      }
      await setOverride(me, 'member', p.memberId, l.key, l.url, before);
      saved++;
      changed.push(label[l.key] ?? l.key);
    }
    // Saved here as on the member's own page: the links are now the editor's, not Wikipedia's.
    if (changed.length) await dropSocialSource(me, p.memberId);
    lines.push({ line: p.line, raw: p.raw, who: p.memberName, ok: true, message: changed.length ? `সংরক্ষিত: ${changed.join(', ')}` : 'আগের মতোই আছে' });
  }
  revalidatePath('/admin/social');
  return { saved, unchanged, lines };
}

// The field comes bound from the button (`revertOverride.bind(null, key)`), not as a
// name/value pair: React replaces a formAction button's name with its own action id,
// so `fd.get('field')` was always empty and every revert threw "bad field".
export async function revertOverride(field: string, fd: FormData) {
  const me = await requireAdmin();
  const type = str(fd, 'entity_type') as EntityType;
  const id = str(fd, 'entity_id');
  if (!EDITABLE[type]?.some((f) => f.key === field)) throw new Error('bad field');
  // The revert has its own small form (so the edit form's unsaved text is not
  // submitted and lost); the value being removed travels as `current`.
  await clearOverride(me, type, id, field, orNull(str(fd, 'current')));
  const page = `/admin/${ADMIN_PATH[type]}/${id}`;
  revalidatePath(page);
  redirect(`${page}?reverted=1`);
}

export async function toggleHidden(fd: FormData) {
  const me = await requireAdmin();
  const type = str(fd, 'entity_type') as 'member' | 'committee';
  const id = str(fd, 'entity_id');
  if ((type !== 'member' && type !== 'committee') || !id) throw new Error('bad entity');
  const hide = str(fd, 'hide') === '1';
  await setHidden(me, type, id, hide, orNull(str(fd, 'reason')));
  const seg = type === 'member' ? 'members' : 'committees';
  revalidatePath(`/admin/${seg}/${id}`);
  redirect(`/admin/${seg}/${id}?${hide ? 'hidden' : 'unhidden'}=1`);
}

/* ---------------- news ---------------- */

export async function saveNews(fd: FormData) {
  const me = await requireAdmin();
  const id = orNull(str(fd, 'id'));
  const input = {
    title_bn: str(fd, 'title_bn').trim(),
    source_name: str(fd, 'source_name').trim(),
    source_url: str(fd, 'source_url').trim(),
    published_on: str(fd, 'published_on').trim(),
    excerpt_bn: orNull(str(fd, 'excerpt_bn')),
    member_id: orNull(str(fd, 'member_id')),
    seat_slug: orNull(str(fd, 'seat_slug')),
  };
  // Sent back to the form, which puts the typed text back, rather than to an error page.
  const back = `/admin/news/${id ?? 'new'}`;
  if (!input.title_bn || !input.source_name || !input.source_url || !input.published_on) redirect(`${back}?invalid=required`);
  if (!/^https?:\/\/\S+$/.test(input.source_url)) redirect(`${back}?invalid=url`);
  const savedId = await upsertNews(me, id, input);
  revalidatePath('/admin/news');
  redirect(`/admin/news/${savedId}?saved=1`);
}

export async function changeNewsStatus(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'draft' | 'published' | 'rejected';
  if (!['draft', 'published', 'rejected'].includes(status)) throw new Error('bad status');
  await setNewsStatus(me, id, status);
  revalidatePath('/admin/news');
  redirect(`/admin/news/${id}?status=${status}`);
}

/* ---------------- corrections ---------------- */

export async function decideCorrection(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'accepted' | 'rejected';
  if (!['accepted', 'rejected'].includes(status)) throw new Error('bad status');
  await resolveCorrection(me, id, status, orNull(str(fd, 'note')));
  revalidatePath('/admin/corrections');
  redirect('/admin/corrections');
}

/* ---------------- users ---------------- */

export async function createAdmin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireSuperAdmin();
  const email = str(fd, 'email').trim().toLowerCase();
  const role = str(fd, 'role') === 'super_admin' ? 'super_admin' : 'editor';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'ইমেইল ঠিকানাটি সঠিক নয়।' };
  try {
    const { tempPassword } = await addAdmin(me, email, role);
    revalidatePath('/admin/users');
    return {
      ok: tempPassword
        ? `${email} যোগ হয়েছে। সাময়িক পাসওয়ার্ড (একবারই দেখানো হবে): ${tempPassword}`
        : `${email} যোগ হয়েছে। আগের পাসওয়ার্ড দিয়েই লগইন করতে পারবেন।`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'যোগ করা যায়নি।' };
  }
}

export async function deleteAdmin(fd: FormData) {
  const me = await requireSuperAdmin();
  const userId = str(fd, 'user_id');
  if (userId === me.id) throw new Error('নিজেকে সরানো যাবে না।');
  await removeAdmin(me, userId);
  revalidatePath('/admin/users');
  redirect('/admin/users');
}

/* ---------------- publish ---------------- */

/**
 * Rebuilds the public site. The build fetches parliament.gov.bd again, applies
 * every override and hidden flag, pulls the published news, and prerenders all
 * pages. Nothing an admin saves is visible to the public until this runs.
 */
export async function publishSite(): Promise<ActionState> {
  const me = await requireAdmin();
  const r = await requestRebuild('admin-publish');
  await audit(me, { action: 'site.publish', entity_type: null, entity_id: null, field: null, old_value: null, new_value: r.ok ? 'triggered' : `failed ${r.detail}` });
  if (!r.ok && r.reason === 'no-config') return { error: 'সাইট নতুন করে তৈরির কোনো পথ সেট করা নেই। হোস্টিং প্ল্যাটফর্মের ডিপ্লয় ওয়েবহুক DEPLOY_HOOK_URL হিসেবে, অথবা GitHub-এর MYMP_DEPLOY_TOKEN দিন।' };
  if (!r.ok) return { error: `সাইট নতুন করে তৈরি শুরু করা যায়নি: ${r.detail}` };
  return { ok: 'সাইট নতুন করে তৈরি হচ্ছে। ৫-১০ মিনিটের মধ্যে পরিবর্তন mymp.bd-তে দেখা যাবে।' };
}

/* ---------------- government posts sync ---------------- */

const syncMembers = () =>
  allMembers.filter((m) => !m.resignedOn).map((m) => ({ id: m.id, nameBn: m.nameBn, nameEn: m.nameEn, seatEn: m.seat?.nameEn ?? null }));

function runSummary(r: Awaited<ReturnType<typeof runPostsSync>>): ActionState {
  if (r.status === 'skipped') return { error: 'আরেকটি সিঙ্ক এখন চলছে; কয়েক মিনিট পরে আবার চেষ্টা করুন।' };
  if (r.status === 'failed') return { error: `সিঙ্ক ব্যর্থ, কিছু বদলানো হয়নি: ${r.errors.map((e) => `${e.source}: ${e.message}`).join('; ')}` };
  const bnN = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
  return { ok: `সফল: ${bnN(r.add.length)}টি যুক্ত, ${bnN(r.close.length)}টি শেষ, ${bnN(r.unchanged)}টি অপরিবর্তিত, ${bnN(r.unmatched.length)}টি নাম মেলেনি।${r.deploy ? ` ${r.deploy === 'site rebuild requested' ? 'সাইট নতুন করে তৈরি হচ্ছে।' : r.deploy}` : ''}` };
}

/** Runs the posts sync now, the same run the schedule makes. */
export async function runPostsSyncNow(): Promise<ActionState> {
  const me = await requireAdmin();
  try {
    const r = await runPostsSync({ trigger: 'admin', members: syncMembers() });
    await audit(me, { action: 'posts.sync', entity_type: null, entity_id: r.runId ? String(r.runId) : null, field: null, old_value: null, new_value: r.status });
    revalidatePath('/admin/sync');
    return runSummary(r);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * An editor places a listed name: an MP from the picker, or "not an MP". The
 * choice is remembered in post_aliases and the sync runs at once to apply it.
 */
export async function resolvePostName(fd: FormData) {
  const me = await requireAdmin();
  const nameKey = str(fd, 'name_key');
  const nameBn = str(fd, 'name_bn');
  const memberId = orNull(str(fd, 'member_id'));
  if (!nameKey || !nameBn) return;
  if (memberId && !allMembers.some((m) => m.id === memberId)) return;
  await setPostAlias(me, nameKey, nameBn, memberId);
  await runPostsSync({ trigger: 'admin', members: syncMembers() }).catch(() => null);
  revalidatePath('/admin/sync');
}

/**
 * The whole adviser list at once. An editor confirms none of them are members;
 * each name is written to post_aliases, so no later run asks about them again.
 */
export async function resolvePostNamesNotMp(fd: FormData) {
  const me = await requireAdmin();
  const entries = fd.getAll('entry').map(String).slice(0, 50);
  let written = 0;
  for (const raw of entries) {
    let pair: unknown;
    try { pair = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(pair)) continue;
    const [key, nameBn] = pair as string[];
    if (!key || !nameBn) continue;
    await setPostAlias(me, key, nameBn, null);
    written++;
  }
  if (!written) return;
  await runPostsSync({ trigger: 'admin', members: syncMembers() }).catch(() => null);
  revalidatePath('/admin/sync');
}

/* ---------------- election results ---------------- */

const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const numOrNull = (s: string) => {
  const t = toLatinDigits(s).replace(/[^\d.]/g, '');
  return t === '' ? null : Number(t);
};

export async function saveResult(fd: FormData) {
  const me = await requireAdmin();
  const seatNo = Number(str(fd, 'seat_no'));
  const parliamentNo = Number(str(fd, 'parliament_no'));
  if (!(seatNo >= 1 && seatNo <= 300) || !(parliamentNo >= 1 && parliamentNo <= 20)) throw new Error('bad seat');
  const back = `/admin/results/${seatNo}?p=${parliamentNo}`;

  // One candidate per line: name | party | votes
  const candidates = str(fd, 'candidates')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = '', party = '', votes = ''] = l.split('|').map((x) => x.trim());
      const v = toLatinDigits(votes).replace(/[^\d]/g, '');
      return { name, party: party || null, votes: v === '' ? NaN : Number(v) };
    });
  if (!candidates.length || candidates.some((c) => !c.name || !Number.isFinite(c.votes) || c.votes < 0)) redirect(`${back}&invalid=candidates`);

  const sourceUrl = str(fd, 'source_url').trim();
  if (!/^https:\/\/\S+$/.test(sourceUrl)) redirect(`${back}&invalid=source`);

  const status = str(fd, 'status') === 'published' ? 'published' : 'draft';
  await upsertResult(me, {
    seat_no: seatNo,
    parliament_no: parliamentNo,
    candidates: candidates.sort((a, b) => b.votes - a.votes),
    total_votes: numOrNull(str(fd, 'total_votes')),
    turnout: numOrNull(str(fd, 'turnout')),
    source_url: sourceUrl,
    source_note: orNull(str(fd, 'source_note')),
    status,
  });
  revalidatePath('/admin/results');
  redirect(`${back}&saved=1`);
}

export async function changeResultStatus(fd: FormData) {
  const me = await requireAdmin();
  const seatNo = Number(str(fd, 'seat_no'));
  const parliamentNo = Number(str(fd, 'parliament_no'));
  const status = str(fd, 'status') === 'published' ? 'published' : 'draft';
  await setResultStatus(me, seatNo, parliamentNo, status);
  revalidatePath('/admin/results');
  redirect(`/admin/results/${seatNo}?p=${parliamentNo}&status=${status}`);
}

/* ---------------- the news and video feed ---------------- */

/**
 * The admin corrects the feed, it does not approve it: items are live as soon
 * as they are collected. Hiding, removing, pinning and attaching by hand all
 * leave the item in the database with a reason and an audit row.
 */
export async function hideFeedItem(fd: FormData) {
  const me = await requireAdmin();
  const itemId = Number(str(fd, 'item_id'));
  const mpId = str(fd, 'mp_id');
  const status = str(fd, 'status') as 'visible' | 'hidden' | 'removed';
  if (!itemId || !mpId || !['visible', 'hidden', 'removed'].includes(status)) return;
  await setAttachmentStatus(me, itemId, mpId, status, orNull(str(fd, 'reason')));
  revalidatePath('/admin/feed');
  revalidatePath('/admin/feed/review');
}

export async function confirmFeedItem(fd: FormData) {
  const me = await requireAdmin();
  const itemId = Number(str(fd, 'item_id'));
  const mpId = str(fd, 'mp_id');
  if (!itemId || !mpId) return;
  await confirmAttachment(me, itemId, mpId);
  revalidatePath('/admin/feed/review');
  revalidatePath('/admin/feed');
}

export async function pinFeedItem(fd: FormData) {
  const me = await requireAdmin();
  const itemId = Number(str(fd, 'item_id'));
  const mpId = str(fd, 'mp_id');
  if (!itemId || !mpId) return;
  const pinned = str(fd, 'pinned') === '1';
  const until = orNull(str(fd, 'until'));
  await setPinned(me, itemId, mpId, pinned, until ? new Date(`${until}T23:59:59+06:00`).toISOString() : null);
  revalidatePath('/admin/feed');
}

export async function attachFeedItem(fd: FormData) {
  const me = await requireAdmin();
  const itemId = Number(str(fd, 'item_id'));
  const mpId = str(fd, 'mp_id');
  if (!itemId || !mpId || !allMembers.some((m) => m.id === mpId)) return;
  await attachByHand(me, itemId, mpId);
  revalidatePath('/admin/feed');
  revalidatePath('/admin/feed/review');
}

/** Paste an address, pick a member: the item is fetched and added. */
export async function addFeedItemByUrl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const url = str(fd, 'url').trim();
  const mpId = str(fd, 'mp_id');
  const title = str(fd, 'title').trim();
  if (!/^https:\/\/[^\s]+$/.test(url)) return { error: 'পুরো ঠিকানা দিন, https:// দিয়ে শুরু।' };
  if (!allMembers.some((m) => m.id === mpId)) return { error: 'সংসদ সদস্য বাছুন।' };
  try {
    const fetched = await fetchItemForUrl(url, title);
    const stored = await upsertItem(fetched);
    if (!stored) return { error: 'যুক্ত করা যায়নি।' };
    await attachByHand(me, stored.id, mpId);
    revalidatePath('/admin/feed');
    return { ok: 'যুক্ত হয়েছে। সদস্যের পাতায় সঙ্গে সঙ্গে দেখা যাবে।' };
  } catch (e) {
    return { error: `আনা গেল না: ${(e as Error).message}` };
  }
}

export async function bulkHideFeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const outlet = orNull(str(fd, 'outlet'));
  const from = orNull(str(fd, 'from'));
  const to = orNull(str(fd, 'to'));
  const reason = str(fd, 'reason').trim();
  if (!outlet && !from && !to) return { error: 'সংবাদমাধ্যম বা তারিখ বাছুন।' };
  if (!reason) return { error: 'কারণ লিখুন।' };
  const { hidden, left } = await bulkHide(me, { outlet: outlet ?? undefined, from: from ?? undefined, to: to ?? undefined }, reason);
  revalidatePath('/admin/feed');
  const bnN = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
  return left
    ? { error: `${bnN(hidden)}টি লুকানো হয়েছে, আরও ${bnN(left)}${left >= 1000 ? '+' : ''}টি বাকি। আবার চাপুন।` }
    : { ok: `${bnN(hidden)}টি সংযুক্তি লুকানো হয়েছে।` };
}

export async function addNameVariant(fd: FormData) {
  const me = await requireAdmin();
  const mpId = str(fd, 'mp_id');
  // Counted after honorifics go, as the matcher will read it: "মোঃ রহিম" is one word, and one word names nobody.
  const tokens = variantTokens(str(fd, 'variant').trim());
  if (!mpId || tokens.length < 2) redirect(`/admin/members/${mpId}?invalidVariant=1`);
  await addVariant(me, mpId, tokens.join(' '));
  revalidatePath(`/admin/members/${mpId}`);
}

export async function deleteNameVariant(fd: FormData) {
  const me = await requireAdmin();
  const id = Number(str(fd, 'id'));
  const mpId = str(fd, 'mp_id');
  if (!id || !mpId) return;
  await removeVariant(me, id, mpId, str(fd, 'variant'));
  revalidatePath(`/admin/members/${mpId}`);
}

/** Runs the news collector now, the same run the schedule makes. */
export async function runFeedCollectorNow(): Promise<ActionState> {
  const me = await requireAdmin();
  try {
    const r = await runRssCollector({ trigger: 'admin', budgetMs: 50_000 });
    await audit(me, { action: 'feed.collect', entity_type: null, entity_id: r.runId ? String(r.runId) : null, field: null, old_value: null, new_value: r.status });
    revalidatePath('/admin/feed/runs');
    const bnN = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
    if (r.status !== 'ok') return { error: `সংগ্রহ ${r.status === 'aborted' ? 'থামানো হয়েছে' : 'ব্যর্থ'}: ${r.errors.map((e) => e.message).join('; ')}` };
    return { ok: `${bnN(r.itemsFound)}টি দেখা হয়েছে, ${bnN(r.itemsNew)}টি নতুন, ${bnN(r.itemsAttached)}টি সদস্যের সঙ্গে যুক্ত (${bnN(r.lowConfidence)}টি যাচাইয়ের অপেক্ষায়)।` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/* ---------------- member data questions ---------------- */

/** Marks a data question settled, or opens it again; the decision is kept in the audit log. */
export async function setQuestionResolved(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, 'question_id');
  const memberId = str(fd, 'member_id');
  const resolve = str(fd, 'resolve') === '1';
  const q = allQuestions().find((x) => x.id === id && x.memberId === memberId);
  if (!q) throw new Error('unknown question');
  await audit(me, {
    action: resolve ? 'question.resolved' : 'question.reopened',
    entity_type: 'member', entity_id: memberId, field: id, old_value: null,
    new_value: orNull(str(fd, 'note'))?.slice(0, 500) ?? null,
  });
  revalidatePath('/admin/questions');
  revalidatePath(`/admin/members/${memberId}`);
  const back = str(fd, 'back');
  // Only this admin's own pages are a place to return to.
  redirect(back.startsWith('/admin/') ? back : '/admin/questions');
}
