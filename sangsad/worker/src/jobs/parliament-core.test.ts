/**
 * The parliament sync on real Postgres (PGlite), fed TEST_ payloads shaped
 * exactly like the source. Run twice to prove idempotence.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema, upsertConstituencySet, upsertParliaments } from '@sangsad/db';
import { aliasVariants, htmlToText, seatInTitle, syncParliament, type ParliamentPayload, type RawMember } from './parliament-core';

const pg = new PGlite();
const db = drizzle(pg, { schema });
const dbDir = resolve(import.meta.dirname, '../../../packages/db');

const place = (externalId: number, en: string, bn: string) => ({ externalId, nameEng: en, nameBng: bn });
const DIV = place(1, 'TEST_North', 'TEST_উত্তর');
const DIST = { ...place(11, 'TEST_Uttarpara', 'TEST_উত্তরপাড়া'), divisionId: 1 };
const seat = (id: number, no: number, en: string, bn: string, electionId: number) => ({
  id, externalId: 1000 + id, electionId, constituencyNo: no, constituencyEng: en, constituencyBng: bn, boundaryDetails: null,
  division: no > 300 ? null : DIV, district: no > 300 ? null : DIST,
});

const member = (over: Partial<RawMember> & { id: number; externalId: string; seatNo: number | null; seatEn: string | null; seatBn: string | null; partyId: number; parliamentNo?: number }): RawMember => ({
  nameEng: null, nameBng: null, empId: null, dateOfBirth: null, gender: 'Male', photoUrl: null, email: null,
  ...over,
  terms: [
    {
      parliamentNo: over.parliamentNo ?? 13,
      startDate: '2026-02-17', endDate: '2031-02-16', status: 'Active',
      party: { id: over.partyId, abbreviation: over.partyId === 1 ? 'TEST_A' : 'TEST_B' },
      constituency: over.seatNo === null ? null : { constituencyNo: over.seatNo, constituencyEng: over.seatEn, constituencyBng: over.seatBn },
    },
  ],
});

const payload = (): ParliamentPayload => ({
  parliamentNumber: 13,
  parties: [
    { id: 1, nameEng: 'TEST_Alpha Party', nameBng: 'TEST_আলফা দল', abbreviation: 'TEST_A' },
    { id: 2, nameEng: 'TEST_Beta Party', nameBng: 'TEST_বিটা দল', abbreviation: 'TEST_B' },
    { id: 3, nameEng: 'TEST_Beta Party (old)', nameBng: 'TEST_বিটা দল (পুরাতন)', abbreviation: 'TEST_B' }, // same abbreviation, different party
  ],
  members: [
    member({ id: 1, externalId: '013000101', empId: 501, nameEng: 'Barrister TEST_Karim Uddin', nameBng: 'ব্যারিস্টার TEST_করিম উদ্দিন', dateOfBirth: '1960-01-02', seatNo: 1, seatEn: 'TEST_Uttarpara-1', seatBn: 'TEST_উত্তরপাড়া-১', partyId: 1, photoUrl: 'https://prp.parliament.gov.bd/api/files?_=TEST1', email: 'test.1@parliament.gov.bd', terms: undefined }),
    // Same English name as the next one: the seat must disambiguate the slug.
    member({ id: 2, externalId: '013000201', empId: 502, nameEng: 'TEST_Rahim Mia', nameBng: 'TEST_রহিম মিয়া', dateOfBirth: '1970-05-05', seatNo: 2, seatEn: 'TEST_Uttarpara-2', seatBn: 'TEST_উত্তরপাড়া-২', partyId: 2, email: 'rahim@gmail.com' }),
    member({ id: 3, externalId: '013000301', empId: 503, nameEng: 'TEST_Rahim Mia', nameBng: 'TEST_রহিম মিয়া', dateOfBirth: '1980-06-06', seatNo: 3, seatEn: 'TEST_Uttarpara-3', seatBn: 'TEST_উত্তরপাড়া-৩', partyId: 1 }),
    member({ id: 4, externalId: '013030101', empId: 504, nameEng: 'TEST_Salma Begum', nameBng: 'TEST_সালমা বেগম', dateOfBirth: '1975-07-07', gender: 'Female', seatNo: 301, seatEn: 'Women Seat-1', seatBn: 'মহিলা আসন-১', partyId: 1, speakerDetailsBioBn: '<p><strong>TEST_ জীবনী</strong></p><p>প্রথম অনুচ্ছেদ।</p>' }),
  ].map((m) => (m.terms ? m : { ...m, terms: member({ ...m, seatNo: 1, seatEn: 'TEST_Uttarpara-1', seatBn: 'TEST_উত্তরপাড়া-১', partyId: 1 }).terms!.map((t) => ({ ...t, isSpeaker: true })) })),
  officers: [
    { role: 'SPEAKER', nameBn: 'ব্যারিস্টার TEST_করিম উদ্দিন', nameEn: 'Barrister TEST_Karim Uddin', isCurrent: true, parliamentNo: 13 },
    { role: 'CHIEF_WHIP', nameBn: 'TEST_সালমা বেগম', nameEn: 'TEST_Salma Begum', isCurrent: true, parliamentNo: 13 },
    { role: 'WHIP', nameBn: 'TEST_রহিম মিয়া', nameEn: 'TEST_Rahim Mia', isCurrent: true, parliamentNo: 13 }, // ambiguous: two Rahim Mia, must be skipped
    { role: 'SPEAKER', nameBn: 'TEST_পুরাতন স্পিকার', nameEn: 'TEST_Old Speaker', isCurrent: false, parliamentNo: 12 },
  ],
  committees: [
    { id: 90, nameEn: 'TEST_Standing Committee on Roads', nameBn: 'TEST_সড়ক কমিটি', type: 'Standing', startDate: '2026-09-01', members: [{ role: 'Chairman', member: { externalId: '013000101' } }, { role: 'Member', member: { externalId: '013000201' } }] },
    { id: 80, nameEn: 'TEST_Standing Committee on Roads', nameBn: 'TEST_সড়ক কমিটি', type: 'Standing', startDate: '2024-03-01', members: [{ role: 'Chairman', member: { externalId: '012009901' } }] }, // previous parliament's copy
    { id: 91, nameEn: 'TEST_Committee on Rivers', nameBn: 'TEST_নদী কমিটি', type: 'Standing', startDate: '2024-03-02', members: [{ role: 'Chairman', member: { externalId: '012000501' } }, { role: 'Member', member: { externalId: '013000301' } }] }, // stale roster
  ],
  sessions: [
    { id: 1533, titleBn: 'সেশন ৩', titleEn: 'Session 3', startDate: '2026-08-27', endDate: null, poripotras: [{ id: 18, poripotraNo: 1, orderOfTheDays: [{ id: 163, titleBn: 'দিনের কার্যসূচি-২৭-০৮-২০২৬', date: '2026-08-27', pdfUrl: 'https://www.parliament.gov.bd/api/upload/TEST1.pdf' }, { id: 164, titleBn: 'দিনের কার্যসূচি-৩০-০৮-২০২৬', date: '2026-08-30', pdfUrl: 'https://www.parliament.gov.bd/api/upload/TEST2.pdf' }] }] },
  ],
  notices: [
    { id: 1, noticeType: 'NOC_GO', category: 'GO', date: '2026-09-09', titleBn: 'জনাব TEST_করিম উদ্দিন, ১ TEST_উত্তরপাড়া-১', pdfUrl: 'https://www.parliament.gov.bd/api/upload/TEST-n1.pdf', committeeId: null },
    { id: 2, noticeType: 'NOC_GO', category: 'NOC', date: '2026-09-08', titleBn: 'বাংলাদেশ সংসদের মাননীয় হুইপ জনাব TEST_সালমা বেগম এর সফরের অনুমোদন', pdfUrl: null, committeeId: null },
    { id: 3, noticeType: 'COMMITTEE', category: '', date: '2026-09-10', titleBn: 'TEST_সড়ক কমিটির ২য় বৈঠক', pdfUrl: null, committeeId: 80 }, // refers to the previous parliament's record of the same committee
    { id: 4, noticeType: 'TENDER', category: '', date: '2026-09-10', titleBn: 'TEST_ দরপত্র', pdfUrl: null, committeeId: null },
    { id: 5, noticeType: 'NOC_GO', category: 'GO', date: '2026-09-07', titleBn: 'TEST_আমেনা আক্তার (পাসপোর্ট নং- A0)', pdfUrl: null, committeeId: null }, // staff, no member
    { id: 6, noticeType: 'GENERAL', category: 'notification', date: '2026-09-07', titleBn: 'TEST_ সংসদীয় ককাস', pdfUrl: null, committeeId: null },
  ],
  earlier: {
    12: [
      // Same person id and seat: matches Karim (person-id).
      member({ id: 900, externalId: '012000101', empId: 501, nameEng: 'Barrister TEST_Karim Uddin', nameBng: null, dateOfBirth: '1900-01-01', seatNo: 1, seatEn: 'TEST_UTTARPARA-1', seatBn: null, partyId: 1, parliamentNo: 12 }),
      // A namesake of the two Rahim Mias with a different id and no usable birth date: must not match.
      member({ id: 901, externalId: '012000901', empId: 777, nameEng: 'TEST_Rahim Mia', nameBng: null, dateOfBirth: '1900-01-01', seatNo: 9, seatEn: 'TEST_Nadigram-9', seatBn: null, partyId: 2, parliamentNo: 12 }),
    ],
  },
});

beforeAll(async () => {
  await pg.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin;');
  await pg.exec('create schema if not exists sangsad;');
  await migrate(db, { migrationsFolder: resolve(dbDir, 'migrations'), migrationsSchema: 'drizzle', migrationsTable: '__drizzle_migrations' });
  await pg.exec(await readFile(resolve(dbDir, 'sql/rls.sql'), 'utf8'));
  await upsertParliaments(db, [
    { parliamentNo: 13, externalId: 112, electionDate: '2026-02-12', oathDate: '2026-02-17', parliamentLastDate: '2031-02-16' },
    { parliamentNo: 12, externalId: 12, electionDate: '2024-01-07', oathDate: '2024-01-30', parliamentLastDate: '2024-08-06' },
  ]);
  await upsertConstituencySet(db, 13, [
    seat(1, 1, 'TEST_Uttarpara-1', 'TEST_উত্তরপাড়া-১', 112), seat(2, 2, 'TEST_Uttarpara-2', 'TEST_উত্তরপাড়া-২', 112),
    seat(3, 3, 'TEST_Uttarpara-3', 'TEST_উত্তরপাড়া-৩', 112), seat(4, 4, 'TEST_Uttarpara-4', 'TEST_উত্তরপাড়া-৪', 112),
    seat(5, 301, 'TEST_Women Seat-1', 'TEST_মহিলা আসন-১', 112),
  ]);
  await upsertConstituencySet(db, 12, [seat(6, 1, 'TEST_UTTARPARA-1', 'TEST_উত্তরপাড়া-১', 12), seat(7, 9, 'TEST_Nadigram-9', 'TEST_নদীগ্রাম-৯', 12)]);
}, 60_000);

afterAll(async () => {
  await pg.close();
});

describe('helpers', () => {
  it('reads the seat number out of a notice title in either script', () => {
    expect(seatInTitle('জনাব মোহাম্মদ নুরুল ইসলাম, ১১৮ ভোলা-৪')).toBe(118);
    expect(seatInTitle('জনাব জীবা আমিনা খান, ৩১২ মহিলা আসন-১২')).toBe(312);
    expect(seatInTitle('Mr. Mohammad Zahirul Islam (293 Chattagram-16)')).toBe(293);
    expect(seatInTitle('TEST_আমেনা আক্তার (পাসপোর্ট নং- A08755425)')).toBeNull();
  });

  it('turns the Speaker biography HTML into paragraphs', () => {
    expect(htmlToText('<p><strong>TEST_ জীবনী</strong></p><p>প্রথম&nbsp;অনুচ্ছেদ।</p>')).toBe('TEST_ জীবনী\nপ্রথম অনুচ্ছেদ।');
  });

  it('derives aliases without honorifics and with nicknames', () => {
    const a = aliasVariants('ব্যারিস্টার TEST_করিম উদ্দিন', 'Barrister TEST_Karim Uddin (Kuddus)').map((x) => x.alias);
    expect(a).toContain('TEST_করিম উদ্দিন');
    expect(a).toContain('TEST_Karim Uddin (Kuddus)');
    expect(a).toContain('Kuddus');
  });
});

describe('syncParliament on PGlite', () => {
  it('loads everything and is idempotent', async () => {
    const first = await syncParliament(db, payload());
    expect(first.members).toBe(4);
    expect(first.parties).toBe(3);
    const second = await syncParliament(db, payload());
    expect(second.members).toBe(4);

    const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.members);
    expect(m?.n).toBe(4);
    const [terms] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.memberTerms);
    // 4 MP terms + Speaker (flag and officers list, same row) + Chief Whip + 1 earlier term
    expect(terms?.n).toBe(4 + 1 + 1 + 1);
  });

  it('keys parties on the source id, not the abbreviation', async () => {
    const rows = await db.select({ short: schema.parties.shortName }).from(schema.parties);
    expect(rows.filter((r) => r.short === 'TEST_B')).toHaveLength(2);
  });

  it('disambiguates same-name slugs with the seat and keeps only official mail', async () => {
    const rows = await db.select({ slug: schema.members.slug, email: schema.members.officialEmail, bio: schema.members.officialBioBn }).from(schema.members).orderBy(schema.members.id);
    expect(rows.map((r) => r.slug)).toEqual(['barrister-test-karim-uddin', 'test-rahim-mia-test-uttarpara-2', 'test-rahim-mia-test-uttarpara-3', 'test-salma-begum']);
    expect(rows[0]!.email).toBe('test.1@parliament.gov.bd');
    expect(rows[1]!.email).toBeNull(); // a gmail address is not an official one
    expect(rows[3]!.bio).toBe('TEST_ জীবনী\nপ্রথম অনুচ্ছেদ।');
  });

  it('records officer roles only when the name is unambiguous', async () => {
    const roles = await db
      .select({ role: schema.memberTerms.role, name: schema.members.nameEn })
      .from(schema.memberTerms)
      .innerJoin(schema.members, eq(schema.members.id, schema.memberTerms.memberId))
      .where(sql`${schema.memberTerms.role} <> 'MP'`);
    const pairs = roles.map((r) => `${r.role}:${r.name}`).sort();
    expect(pairs).toEqual(['Chief Whip:TEST_Salma Begum', 'Speaker:Barrister TEST_Karim Uddin']);
  });

  it('keeps one record per committee and withholds a stale roster', async () => {
    const rows = await db.select().from(schema.committees).orderBy(schema.committees.slug);
    expect(rows).toHaveLength(2);
    const roads = rows.find((r) => r.slug === 'test-standing-committee-on-roads')!;
    expect(roads.rosterCurrent).toBe(true);
    expect(roads.sourceId).toBe(90);
    const rivers = rows.find((r) => r.slug === 'test-committee-on-rivers')!;
    expect(rivers.rosterCurrent).toBe(false);
    expect(rivers.sourceMemberCount).toBe(2);
    const [riverMembers] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.memberCommittees).where(eq(schema.memberCommittees.committeeId, rivers.id));
    expect(riverMembers?.n).toBe(0);
    const [roadMembers] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.memberCommittees).where(eq(schema.memberCommittees.committeeId, roads.id));
    expect(roadMembers?.n).toBe(2);
  });

  it('stores sittings and only the notices that concern the House', async () => {
    const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sittings);
    expect(s?.n).toBe(2);
    const kept = await db.select({ sourceId: schema.notices.sourceId, committeeId: schema.notices.committeeId }).from(schema.notices).orderBy(schema.notices.sourceId);
    expect(kept.map((k) => k.sourceId)).toEqual([1, 2, 3, 6]); // tender and staff order dropped
    const roads = await db.select({ id: schema.committees.id }).from(schema.committees).where(eq(schema.committees.slug, 'test-standing-committee-on-roads'));
    expect(kept.find((k) => k.sourceId === 3)!.committeeId).toBe(roads[0]!.id); // mapped through the previous parliament's record id
    const links = await db
      .select({ by: schema.noticeMembers.matchedBy, name: schema.members.nameEn, notice: schema.notices.sourceId })
      .from(schema.noticeMembers)
      .innerJoin(schema.members, eq(schema.members.id, schema.noticeMembers.memberId))
      .innerJoin(schema.notices, eq(schema.notices.id, schema.noticeMembers.noticeId));
    expect(links.map((l) => `${l.notice}:${l.name}:${l.by}`).sort()).toEqual(['1:Barrister TEST_Karim Uddin:seat', '2:TEST_Salma Begum:name']);
  });

  it('attaches an earlier term only with corroboration', async () => {
    const earlier = await db
      .select({ name: schema.members.nameEn, matchedBy: schema.memberTerms.matchedBy, seat: schema.memberTerms.seatLabelEn, constituencyId: schema.memberTerms.constituencyId })
      .from(schema.memberTerms)
      .innerJoin(schema.members, eq(schema.members.id, schema.memberTerms.memberId))
      .where(isNotNull(schema.memberTerms.matchedBy));
    expect(earlier).toHaveLength(1);
    expect(earlier[0]).toMatchObject({ name: 'Barrister TEST_Karim Uddin', matchedBy: 'person-id', seat: 'TEST_UTTARPARA-1' });
    expect(earlier[0]!.constituencyId).not.toBeNull(); // linked to the 12th parliament's seat row
  });

  it('clears our photo copy when the source photo changes', async () => {
    await db.update(schema.members).set({ photoUrl: 'https://example.org/TEST-copy.jpg' }).where(eq(schema.members.sourceExternalId, '013000101'));
    const p = payload();
    p.members[0]!.photoUrl = 'https://prp.parliament.gov.bd/api/files?_=TEST1-new';
    const r = await syncParliament(db, p);
    expect(r.photoSourceChanged).toBe(1);
    const [row] = await db.select({ photoUrl: schema.members.photoUrl }).from(schema.members).where(eq(schema.members.sourceExternalId, '013000101'));
    expect(row?.photoUrl).toBeNull();
  });
});
