/**
 * The `parliament:photos` job: copy each sitting member's official photo from
 * parliament.gov.bd into our public Supabase Storage bucket, so profiles never
 * hotlink a government server and never show a third-party image.
 *
 * Only members whose copy is missing are fetched (the sync clears photo_url
 * when the source URL changes). A copy that lives on another Supabase host is
 * treated as missing too: after the move from supabase.co to the VPS, every
 * profile still pointed at the old project, which would have taken all 347
 * photos down with it the day that project was paused. A failed fetch leaves
 * photo_url null, which the site renders as the neutral placeholder, and is
 * retried on the next run.
 */
import { createClient } from '@supabase/supabase-js';
import { and, eq, isNotNull, isNull, notLike, or, sql } from 'drizzle-orm';
import { schema } from '@sangsad/db';
import type { Db } from './parliament-core';
import { uploadMirrorFile } from './mirror';

const BUCKET = 'member-photos';
const UA = process.env.SCRAPER_USER_AGENT ?? 'MyMPBot/1.0 (+https://mymp.bd/somporke)';
const ALLOWED_HOSTS = new Set(['prp.parliament.gov.bd', 'www.parliament.gov.bd', 'parliament.gov.bd']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runPhotos(db: Db, parliamentNumber = 13): Promise<{ itemsFound: number; itemsNew: number; failed: string[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for photos');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 2 * 1024 * 1024 });
  if (bucketError && !/already exists/i.test(bucketError.message)) throw new Error(`bucket: ${bucketError.message}`);

  const { members, memberTerms, parliaments } = schema;
  const pending = await db
    .select({ id: members.id, externalId: members.sourceExternalId, source: members.photoSourceUrl, nameBn: members.nameBn })
    .from(members)
    .innerJoin(memberTerms, and(eq(memberTerms.memberId, members.id), eq(memberTerms.role, 'MP')))
    .innerJoin(parliaments, and(eq(parliaments.id, memberTerms.parliamentId), eq(parliaments.number, parliamentNumber)))
    .where(and(isNotNull(members.photoSourceUrl), or(isNull(members.photoUrl), notLike(members.photoUrl, `${url.replace(/\/$/, '')}/%`))));

  let copied = 0;
  const failed: string[] = [];
  for (const m of pending) {
    await sleep(1000);
    try {
      const src = new URL(m.source!);
      if (!ALLOWED_HOSTS.has(src.hostname)) throw new Error(`refusing photo host ${src.hostname}`);
      const res = await fetch(src, { headers: { 'user-agent': UA, accept: 'image/*' }, signal: AbortSignal.timeout(30000) });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 1000) throw new Error(`suspiciously small image (${bytes.length} bytes)`);
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const path = `${m.externalId}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type.split(';')[0], upsert: true });
      if (error) throw new Error(`upload: ${error.message}`);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await db
        .update(members)
        .set({ photoUrl: data.publicUrl, photoCheckedAt: new Date(), updatedAt: new Date() })
        .where(eq(members.id, m.id));
      copied++;
    } catch (err) {
      failed.push(`${m.nameBn} (${m.externalId}): ${(err as Error).message}`);
      await db.update(members).set({ photoCheckedAt: sql`now()` }).where(eq(members.id, m.id));
    }
  }
  process.stdout.write(`  photos: ${pending.length} pending, ${copied} copied, ${failed.length} failed\n`);
  for (const f of failed) process.stdout.write(`    failed: ${f}\n`);

  // The map mymp.bd's build reads: member id → our copy. The copy time rides
  // along as ?v= so a replaced photo is never served from a stale cache.
  const stored = await db
    .select({ externalId: members.sourceExternalId, url: members.photoUrl, checked: members.photoCheckedAt })
    .from(members)
    .innerJoin(memberTerms, and(eq(memberTerms.memberId, members.id), eq(memberTerms.role, 'MP')))
    .innerJoin(parliaments, and(eq(parliaments.id, memberTerms.parliamentId), eq(parliaments.number, parliamentNumber)))
    .where(isNotNull(members.photoUrl));
  const photos: Record<string, string> = {};
  for (const r of stored) if (r.externalId && r.url) photos[r.externalId] = r.checked ? `${r.url}?v=${r.checked.getTime()}` : r.url;
  const generatedAt = new Date().toISOString();
  const mapUrl = await uploadMirrorFile(supabase, 'photos', { version: 1, generatedAt, photos }, generatedAt.slice(0, 10));
  process.stdout.write(`  photo map: ${Object.keys(photos).length} members → ${mapUrl}\n`);

  return { itemsFound: pending.length, itemsNew: copied, failed };
}
