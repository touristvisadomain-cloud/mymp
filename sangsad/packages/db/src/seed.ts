/**
 * Seed reference data from parliament.gov.bd: every parliament the source
 * knows, and the constituency set of each election it holds rows for.
 *
 * Network here, logic in seed-core.ts (shared with the PGlite integration
 * test). Re-running is safe: every write is an upsert on the source's ids.
 * Divisions and districts come from the current election's set only (its
 * spellings, Bogura and Cumilla, and the only set with divisions on every
 * seat). Every other set runs after it and looks districts up by the
 * source's district id, which is the same across sets.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { parliamentGet, parliamentGetAll } from '@sangsad/shared';
import { getDb } from './client';
import { upsertConstituencySet, upsertParliaments, type SrcConstituency, type SrcParliament } from './seed-core';

config({ path: resolve(import.meta.dirname, '../../../../.env.local') });
config({ path: resolve(import.meta.dirname, '../../../.env.local') });
config({ path: resolve(import.meta.dirname, '../../../.env') });

const CURRENT_PARLIAMENT = 13;

async function main() {
  const db = getDb();

  const rawParliaments = await parliamentGet<SrcParliament[]>('/api/parliaments');
  const n = await upsertParliaments(db, rawParliaments);
  const current = rawParliaments.find((p) => p.parliamentNo === CURRENT_PARLIAMENT);
  if (!current) throw new Error(`parliament ${CURRENT_PARLIAMENT} not in source`);
  console.log(`parliaments: ${n} upserted; current = ${CURRENT_PARLIAMENT} (election set ${current.externalId})`);

  const all = await parliamentGetAll<SrcConstituency>('/api/constituencies', 100, (page, pages, count) =>
    process.stdout.write(`  constituencies page ${page}/${pages} — ${count}\n`),
  );

  let currentCount = 0;
  const ordered = [current, ...rawParliaments.filter((p) => p !== current).sort((a, b) => a.parliamentNo - b.parliamentNo)];
  for (const p of ordered) {
    const rows = all.filter((c) => c.electionId === p.externalId);
    if (!rows.length) continue;
    const r = await upsertConstituencySet(db, p.parliamentNo, rows, { writePlaces: p === current });
    console.log(
      `parliament ${p.parliamentNo}: ${r.constituencies} constituencies (${r.territorial} territorial + ${r.reserved} reserved), ${r.divisions} divisions, ${r.districts} districts`,
    );
    for (const d of r.skippedDistricts) console.warn(`  district ${d} has no division on its seat rows; skipped`);
    for (const d of r.divisionConflicts) console.log(`  division check: ${d}`);
    if (r.unknownDistricts.length) console.warn(`  districts not in the current set, seats left without a district: ${r.unknownDistricts.join(', ')}`);
    for (const d of r.duplicateNames) console.log(`  seat ${d}: same name as an earlier seat in the source; slug takes the seat number`);
    if (p.parliamentNo === CURRENT_PARLIAMENT) {
      currentCount = r.constituencies;
      if (r.missingBoundary) console.log(`  note: ${r.missingBoundary} territorial constituencies have no boundary text in the source`);
    }
  }
  if (currentCount !== 350) console.warn(`  WARNING: expected 350 constituencies for parliament ${CURRENT_PARLIAMENT}, source has ${currentCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('seed failed:', err.message ?? err);
  process.exit(1);
});
