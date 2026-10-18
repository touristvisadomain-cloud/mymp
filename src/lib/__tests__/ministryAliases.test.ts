import test from 'node:test';
import assert from 'node:assert/strict';
import { ministryAliases, rankAliases } from '../../../config/ministry-aliases';
import { foldedMatch, matchTier } from '../search';

// Run with: npm test

/** The cabinet page's search, as MinistersBrowser does it: every typed word somewhere among the ministry's name and shortcuts. */
function found(query: string, ministryBn: string): boolean {
  const q = query.trim().toLowerCase();
  if (ministryBn.toLowerCase().includes(q)) return true;
  return foldedMatch(query, [ministryBn, ...ministryAliases(ministryBn)]);
}

const ICT = 'ডাক, টেলিযোগাযোগ ও তথ্যপ্রযুক্তি মন্ত্রণালয়';
const INFO = 'তথ্য ও সম্প্রচার মন্ত্রণালয়';

test('ICT, in either script and either case, finds the ICT ministry', () => {
  for (const q of ['ICT', 'ict', 'আইসিটি', 'telecom', 'ডাক']) assert.ok(found(q, ICT), q);
  assert.ok(!found('ict', INFO));
});

test('তথ্য finds both the information ministry and the ICT one, as the word is in both', () => {
  assert.ok(found('তথ্য', INFO));
  assert.ok(found('তথ্য', ICT));
  assert.ok(found('information', INFO));
  assert.ok(found('broadcasting', INFO));
});

test('common English names and short Bangla words', () => {
  assert.ok(found('rail', 'রেলপথ মন্ত্রণালয়'));
  assert.ok(found('রেল', 'রেলপথ মন্ত্রণালয়'));
  assert.ok(found('LGRD', 'স্থানীয় সরকার, পল্লী উন্নয়ন ও সমবায় মন্ত্রণালয়'));
  assert.ok(found('home', 'স্বরাষ্ট্র মন্ত্রণালয়'));
  assert.ok(found('finance', 'অর্থ মন্ত্রণালয়'));
  assert.ok(!found('finance', 'রেলপথ মন্ত্রণালয়'));
});

test("the list's typing slips reach the same shortcuts", () => {
  assert.deepEqual(ministryAliases('বিজ্ঞানও প্রযুক্তি মন্ত্রণালয়'), ministryAliases('বিজ্ঞান ও প্রযু্ক্তি মন্ত্রণালয়'));
  assert.ok(ministryAliases('প্রবাসী কল্যাণ ও বৈদেশিক কর্মসংংস্থান মন্ত্রণালয়').includes('Expatriates'));
});

test('a ministry with no shortcuts is still found by its own name, and nothing else', () => {
  assert.deepEqual(ministryAliases('কোনো নতুন মন্ত্রণালয়'), []);
  assert.ok(found('নতুন', 'কোনো নতুন মন্ত্রণালয়'));
  assert.ok(!found('ict', 'কোনো নতুন মন্ত্রণালয়'));
});

test('Bangla typed in English letters: "totto" finds the information ministry', () => {
  for (const q of ['totto', 'tottho', 'tothyo']) assert.ok(found(q, INFO), q);
  assert.ok(!found('totto', ICT));
  assert.ok(found('shikkha', 'শিক্ষা মন্ত্রণালয়'));
  assert.ok(found('krishi', 'কৃষি মন্ত্রণালয়'));
});

test('nonsense finds nothing, even where it folds to one letter', () => {
  for (const q of ['zzzz', 'xx', 'j']) {
    for (const m of [ICT, INFO, 'রেলপথ মন্ত্রণালয়', 'অর্থ মন্ত্রণালয়']) assert.ok(!found(q, m), `${q} in ${m}`);
  }
});

test('আই সি টি, typed with spaces, finds আইসিটি', () => {
  assert.ok(found('আই সি টি', ICT));
});

test('a short English word matches only as typed: rail is not religious', () => {
  assert.ok(found('rail', 'রেলপথ মন্ত্রণালয়'));
  assert.ok(!found('rail', 'ধর্ম বিষয়ক মন্ত্রণালয়'));
  assert.ok(!found('home', 'ধর্ম বিষয়ক মন্ত্রণালয়'));
});

/** A card's rank found the page's way: the title and its shortcuts. */
const rankFound = (query: string, titleBn: string) => foldedMatch(query, [titleBn, ...rankAliases(titleBn)]);

test('the Prime Minister, however it is typed', () => {
  for (const q of ['Prime Minister', 'prime minister', 'Primie Minister', 'prime', 'PM', 'প্রধানমন্ত্রী', 'প্রধান মন্ত্রী', 'prodhan montri', 'profhan montri', 'prodhanmontri', 'pradhan mantri']) {
    assert.ok(rankFound(q, 'প্রধানমন্ত্রী'), q);
  }
  for (const q of ['Prime Minister', 'prodhan montri', 'PM', 'প্রধানমন্ত্রী']) {
    for (const other of ['মন্ত্রী', 'প্রতিমন্ত্রী', 'উপদেষ্টা']) assert.ok(!rankFound(q, other), `${q} is not ${other}`);
  }
});

test('the other ranks by name', () => {
  assert.ok(rankFound('state minister', 'প্রতিমন্ত্রী'));
  assert.ok(rankFound('protimontri', 'প্রতিমন্ত্রী'));
  assert.ok(rankFound('adviser', 'উপদেষ্টা'));
  assert.ok(rankFound('advisor', 'উপদেষ্টা'));
  assert.ok(!rankFound('zzzzz', 'প্রধানমন্ত্রী'));
});

/** A small cabinet, searched as the page does: only the best tier among the cards shows. */
function cabinetSearch(query: string): string[] {
  const cards = [
    { who: 'PM', title: 'প্রধানমন্ত্রী', ministries: ['মন্ত্রিপরিষদ বিভাগ', 'প্রতিরক্ষা মন্ত্রণালয়'] },
    { who: 'primary adviser', title: 'উপদেষ্টা', ministries: ['প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়', 'শিক্ষা মন্ত্রণালয়'] },
    { who: 'primary state minister', title: 'প্রতিমন্ত্রী', ministries: ['প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়'] },
    { who: 'ICT minister', title: 'মন্ত্রী', ministries: [ICT] },
    { who: 'information minister', title: 'মন্ত্রী', ministries: [INFO] },
    { who: 'railways minister', title: 'মন্ত্রী', ministries: ['রেলপথ মন্ত্রণালয়'] },
  ];
  const scored = cards.map((c) => ({ c, t: matchTier(query, [c.title, ...rankAliases(c.title), ...c.ministries.flatMap((m) => [m, ...ministryAliases(m)])]) }));
  const best = Math.max(0, ...scored.map((x) => x.t));
  return scored.filter((x) => best > 0 && x.t === best).map((x) => x.c.who);
}

test('prime is the Prime Minister alone, not the primary-education ministers', () => {
  for (const q of ['Prime Minister', 'Primie Minister', 'prime', 'PM', 'প্রধানমন্ত্রী', 'প্রধান মন্ত্রী', 'prodhan montri', 'profhan montri', 'prodhanmontri']) {
    assert.deepEqual(cabinetSearch(q), ['PM'], q);
  }
  assert.deepEqual(cabinetSearch('primary'), ['primary adviser', 'primary state minister']);
  assert.deepEqual(cabinetSearch('ICT'), ['ICT minister']);
  assert.deepEqual(cabinetSearch('totto'), ['information minister']);
  // তথ্য is the information ministry's own word; তথ্যপ্রযুক্তি (ICT) only starts with it.
  assert.deepEqual(cabinetSearch('তথ্য'), ['information minister']);
  assert.deepEqual(cabinetSearch('তথ্যপ্রযুক্তি'), ['ICT minister']);
  assert.deepEqual(cabinetSearch('rail'), ['railways minister']);
  assert.deepEqual(cabinetSearch('zzzzz'), []);
});
