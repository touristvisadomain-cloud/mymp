/**
 * Runs the real migration, the real RLS file and the real seed logic against
 * PGlite (Postgres compiled to WASM), so CI proves the database layer without
 * a Supabase project. Data is TEST_-prefixed and never touches the network.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema';
import { listConstituencies } from './queries';
import { upsertConstituencySet, upsertParliaments, type SrcConstituency } from './seed-core';

const pg = new PGlite();
const db = drizzle(pg, { schema });

const place = (externalId: number, en: string, bn: string) => ({ externalId, nameEng: en, nameBng: bn });
const DIV_N = place(1, 'TEST_North', 'TEST_উত্তর');
const DIV_S = place(2, 'TEST_South', 'TEST_দক্ষিণ');
const DIST_A = { ...place(11, 'TEST_Uttarpara', 'TEST_উত্তরপাড়া'), divisionId: 1 };
const DIST_B = { ...place(12, 'TEST_Nadigram', 'TEST_নদীগ্রাম'), divisionId: 1 };
// Like the source, a district's own divisionId uses a different numbering from
// the division objects (8 is nobody's id here); the seat row's division decides.
const DIST_C = { ...place(21, 'TEST_Sagarkul', 'TEST_সাগরকূল'), divisionId: 8 };

const seat = (id: number, no: number, en: string, bn: string, division: typeof DIV_N | null, district: typeof DIST_A | null, boundary: string | null): SrcConstituency => ({
  id,
  externalId: 1000 + id,
  electionId: 112,
  constituencyNo: no,
  constituencyEng: en,
  constituencyBng: bn,
  boundaryDetails: boundary,
  division,
  district,
});

const ROWS: SrcConstituency[] = [
  seat(1, 1, 'TEST_Uttarpara-1', 'TEST_উত্তরপাড়া-১', DIV_N, DIST_A, 'TEST_ সীমানা ১'),
  seat(2, 2, 'TEST_Uttarpara-2', 'TEST_উত্তরপাড়া-২', DIV_N, DIST_A, null),
  seat(3, 3, 'TEST_Nadigram-1', 'TEST_নদীগ্রাম-১', DIV_N, DIST_B, 'TEST_ সীমানা ৩'),
  seat(4, 4, 'TEST_Sagarkul-1', 'TEST_সাগরকূল-১', DIV_S, DIST_C, null),
  seat(5, 301, 'TEST_Women Seat-1', 'TEST_মহিলা আসন-১', null, null, null),
];

beforeAll(async () => {
  // Supabase's roles do not exist in a bare Postgres; the RLS file grants to them.
  await pg.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin;');
  await pg.exec('create schema if not exists sangsad;');
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../migrations'), migrationsSchema: 'drizzle', migrationsTable: '__drizzle_migrations' });
  await pg.exec(await readFile(resolve(import.meta.dirname, '../sql/rls.sql'), 'utf8'));
}, 60_000);

afterAll(async () => {
  await pg.close();
});

describe('migration + RLS + seed on real Postgres (PGlite)', () => {
  it('creates every table the brief asks for', async () => {
    const r = await pg.query<{ n: number }>(
      "select count(*)::int as n from pg_tables where schemaname = 'sangsad' and tablename not like '__drizzle%'",
    );
    expect(r.rows[0]?.n).toBe(28);
  });

  it('enables RLS on every public table', async () => {
    const r = await pg.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'sangsad' and tablename not like '__drizzle%' and not rowsecurity",
    );
    expect(r.rows.map((x) => x.tablename)).toEqual([]);
  });

  it('seeds parliaments and a constituency set idempotently', async () => {
    const raw = [
      { parliamentNo: 13, externalId: 112, electionDate: '2026-02-12', oathDate: '2026-02-17', parliamentLastDate: '2031-02-16' },
      { parliamentNo: 12, externalId: 12, electionDate: '2024-01-07', oathDate: '2024-01-30', parliamentLastDate: '2024-08-06' },
    ];
    expect(await upsertParliaments(db, raw)).toBe(2);
    const first = await upsertConstituencySet(db, 13, ROWS);
    expect(first).toMatchObject({ divisions: 2, districts: 3, constituencies: 5, territorial: 4, reserved: 1, missingBoundary: 2, skippedDistricts: [] });

    // Second run changes nothing and duplicates nothing.
    const second = await upsertConstituencySet(db, 13, ROWS);
    expect(second.constituencies).toBe(5);
    const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.constituencies);
    expect(count[0]?.n).toBe(5);
    const dist = await db.select({ n: sql<number>`count(*)::int` }).from(schema.districts);
    expect(dist[0]?.n).toBe(3);
  });

  it('groups the listing by division and district and separates reserved seats', async () => {
    const listing = await listConstituencies(db, 13);
    expect(listing.total).toBe(5);
    expect(listing.territorial).toBe(4);
    expect(listing.reserved).toBe(1);
    expect(listing.divisions.map((d) => d.division.nameEn)).toEqual(['TEST_North', 'TEST_South']);
    const north = listing.divisions[0]!;
    expect(north.districts.map((d) => d.district.nameEn)).toEqual(['TEST_Uttarpara', 'TEST_Nadigram']);
    expect(north.districts[0]!.constituencies.map((c) => c.number)).toEqual([1, 2]);
    expect(listing.reservedSeats[0]).toMatchObject({ number: 301, isReservedWomen: true, district: null });
    // A missing boundary stays null; the UI turns that into "তথ্য পাওয়া যায়নি".
    expect(north.districts[0]!.constituencies[1]!.boundaryBn).toBeNull();
  });

  it('lets the public read reference data but nothing private', async () => {
    await pg.exec('set role anon');
    try {
      const seats = await pg.query<{ n: number }>('select count(*)::int as n from sangsad.constituencies');
      expect(seats.rows[0]?.n).toBe(5);
      const sittings = await pg.query<{ n: number }>('select count(*)::int as n from sangsad.sittings');
      expect(sittings.rows[0]?.n).toBe(0);
      // Private tables carry no SELECT grant at all, so the refusal is explicit rather than an empty result.
      await expect(pg.query('select count(*) from sangsad.admin_users')).rejects.toThrow(/permission denied/i);
      await expect(pg.query('select count(*) from sangsad.audit_log')).rejects.toThrow(/permission denied/i);
      await expect(pg.query('select count(*) from sangsad.member_aliases')).rejects.toThrow(/permission denied/i);
    } finally {
      await pg.exec('reset role');
    }
  });

  it('refuses public writes except an open correction', async () => {
    await pg.exec('set role anon');
    try {
      await expect(pg.exec("insert into sangsad.members (slug, name_bn) values ('test-x', 'TEST_X')")).rejects.toThrow(/permission denied/i);
      await expect(pg.exec("update sangsad.constituencies set name_bn = 'TEST_hack'")).rejects.toThrow(/permission denied/i);
      await pg.exec("insert into sangsad.corrections (message, page_path) values ('TEST_ ভুল আছে', '/sangsad')");
      await expect(
        pg.exec("insert into sangsad.corrections (message, status, resolution) values ('TEST_', 'resolved', 'done')"),
      ).rejects.toThrow(/row-level security|policy/i);
    } finally {
      await pg.exec('reset role');
    }
    const rows = await db.select({ n: sql<number>`count(*)::int` }).from(schema.corrections);
    expect(rows[0]?.n).toBe(1);
  });

  it('shows only verified editorial rows to the public', async () => {
    const [seatRow] = await db.select({ id: schema.constituencies.id }).from(schema.constituencies).limit(1);
    const [parl] = await db.select({ id: schema.parliaments.id }).from(schema.parliaments).where(sql`number = 13`);
    await db.insert(schema.electionResults).values([
      { parliamentId: parl!.id, constituencyId: seatRow!.id, candidateName: 'TEST_A', votes: 10, sourceUrl: 'https://example.org/TEST', status: 'pending' },
      { parliamentId: parl!.id, constituencyId: seatRow!.id, candidateName: 'TEST_B', votes: 20, sourceUrl: 'https://example.org/TEST', status: 'verified', isWinner: true },
    ]);
    await pg.exec('set role anon');
    try {
      const r = await pg.query<{ candidate_name: string }>('select candidate_name from sangsad.election_results');
      expect(r.rows.map((x) => x.candidate_name)).toEqual(['TEST_B']);
    } finally {
      await pg.exec('reset role');
    }
  });

  it('keeps a repeated seat name as published and gives the later seat its own slug', async () => {
    const rows = [
      // An older set: no division on the rows, districts only looked up.
      { ...seat(21, 241, 'TEST_Uttarpara-1', 'TEST_উত্তরপাড়া-১', null, DIST_A, null), electionId: 12 },
      { ...seat(22, 242, 'TEST_Uttarpara-1', 'TEST_উত্তরপাড়া-১', null, DIST_A, null), electionId: 12 },
      { ...seat(23, 243, 'TEST_Nowhere-1', 'TEST_কোথাও-১', null, { ...place(99, 'TEST_Nowhere', 'TEST_কোথাও'), divisionId: 1 }, null), electionId: 12 },
    ];
    const r = await upsertConstituencySet(db, 12, rows, { writePlaces: false });
    expect(r.duplicateNames).toEqual(['242 TEST_Uttarpara-1']);
    expect(r.unknownDistricts).toEqual(['TEST_Nowhere']);
    await upsertConstituencySet(db, 12, rows, { writePlaces: false });
    const dist = await db.select({ n: sql<number>`count(*)::int` }).from(schema.districts);
    expect(dist[0]?.n).toBe(3);
    const got = await db
      .select({ number: schema.constituencies.number, slug: schema.constituencies.slug, nameBn: schema.constituencies.nameBn, district: schema.constituencies.districtId })
      .from(schema.constituencies)
      .innerJoin(schema.parliaments, sql`${schema.parliaments.id} = ${schema.constituencies.parliamentId}`)
      .where(sql`${schema.parliaments.number} = 12`)
      .orderBy(schema.constituencies.number);
    const [uttarpara] = await db.select({ id: schema.districts.id }).from(schema.districts).where(sql`${schema.districts.sourceId} = 11`);
    expect(got).toEqual([
      { number: 241, slug: 'test-uttarpara-1', nameBn: 'TEST_উত্তরপাড়া-১', district: uttarpara!.id },
      { number: 242, slug: 'test-uttarpara-1-242', nameBn: 'TEST_উত্তরপাড়া-১', district: uttarpara!.id },
      { number: 243, slug: 'test-nowhere-1', nameBn: 'TEST_কোথাও-১', district: null },
    ]);
  });
});
