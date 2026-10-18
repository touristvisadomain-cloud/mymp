import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSeats, placeNames, wardNumbers, type FinderSeat, type PlaceNames } from '../findSeat';

// Boundary text as the Election Commission writes it (data/seats.json, 2026).
const seat = (no: number, name: string, district: string, boundary: string): FinderSeat => ({
  no, seat: name, seatEn: null, slug: `s-${no}`, district, districtEn: null, boundary, member: null,
});
const SEATS = [
  seat(175, 'ঢাকা-২', 'ঢাকা', '(ক)নিম্নলিখিত ইউনিয়ন সমূহ ব্যতীত কেরানিগঞ্জ উপজেলাঃ(১) জিনজিরা, (২)আগানগর,(৩) তেঘরিয়া,(৪) কোন্ডা ও(৫) শুভাট্যা, (খ)ঢাকা দক্ষিন সিটি কর্পোরেশনের ওয়ার্ড ৫৫,৫৬, ও ৫৭ এবং (গ)সাভার উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ(১) আমিনবাজার,(২) তেতুলঝড়া ও(৩) ভাকুর্তা'),
  seat(176, 'ঢাকা-৩', 'ঢাকা', 'কেরানিগঞ্জ উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১) জিনজিরা, (২) আগানগর, (৩) তেঘরিয়া, (৪) কোন্ডা ও (৫) শুভাট্যা'),
  seat(183, 'ঢাকা-১০', 'ঢাকা', 'ঢাকা দক্ষিন সিটি কর্পোরেশনের ওয়ার্ড- ১৪,১৫,১৬,১৭,১৮ ও ২২'),
  seat(187, 'ঢাকা-১৪', 'ঢাকা', '(ক)ঢাকা উত্তর সিটি কর্পোরেশনের ওয়ার্ড ৭ থেকে ১২ পর্যন্ত এবং (খ)সাভার উপজেলার কাউন্দিয়া ইউনিয়ন'),
  seat(116, 'ভোলা-২', 'ভোলা', '(ক) দৌলতখান এবং (খ) বোরহানউদ্দিন উপজেলা'),
  seat(45, 'চাঁপাইনবাবগঞ্জ-২', 'চাঁপাইনবাবগঞ্জ', '(ক) নাচোল, (খ) গোমস্তাপুর এবং (গ) ভোলাহাট উপজেলা'),
];
const where = (q: string) => findSeats(q, SEATS).map((m) => `${m.seat.seat}:${m.kind}${m.partial ? '+part' : ''}`);

test('an upazila finds the seat that holds it whole', () => {
  assert.deepEqual(where('দৌলতখান'), ['ভোলা-২:upazila']);
  assert.deepEqual(where('দৌলতখান উপজেলা'), ['ভোলা-২:upazila']);
});

test('a union listed as an exception belongs to the other seat', () => {
  // ঢাকা-২ holds কেরানিগঞ্জ except জিনজিরা; ঢাকা-৩ holds জিনজিরা.
  assert.deepEqual(where('জিনজিরা'), ['ঢাকা-৩:union']);
  assert.deepEqual(where('আমিনবাজার'), ['ঢাকা-২:union']);
});

test('a split upazila shows every seat that holds part of it', () => {
  assert.deepEqual(where('কেরানীগঞ্জ').sort(), ['ঢাকা-২:upazila+part', 'ঢাকা-৩:upazila+part']);
});

test('a city ward is found by its number among the ward list', () => {
  assert.deepEqual(where('ঢাকা দক্ষিণ ওয়ার্ড ১৫'), ['ঢাকা-১০:ward']);
  assert.deepEqual(where('ওয়ার্ড ৫৬'), ['ঢাকা-২:ward']);
});

test('a district, a seat name, and no prefix noise', () => {
  assert.deepEqual(where('ভোলা'), ['ভোলা-২:district']);
  assert.deepEqual(where('ঢাকা-১০'), ['ঢাকা-১০:seat']);
  // ভোলাহাট is found by its own name, not by ভোলা.
  assert.deepEqual(where('ভোলাহাট'), ['চাঁপাইনবাবগঞ্জ-২:upazila']);
});

test('an OpenStreetMap address gives the names to try, most precise first', () => {
  assert.deepEqual(placeNames({ village: 'আমিনবাজার', county: 'সাভার উপজেলা', state_district: 'ঢাকা জেলা' }), ['আমিনবাজার', 'সাভার', 'ঢাকা']);
});

test('a place typed in English is looked up in Bangla', async () => {
  const { toBangla } = await import('../findSeat');
  const table: [string, string][] = [['Savar', 'সাভার'], ['Doulatkhan', 'দৌলতখান'], ['Charfasson', 'চরফ্যাশন'], ['Keraniganj', 'কেরাণীগঞ্জ']];
  assert.equal(toBangla('Savar', table), 'সাভার');
  assert.equal(toBangla('daulatkhan upazila', table), 'দৌলতখান'); // a letter off, and the kind word dropped
  assert.equal(toBangla('charfason', table), 'চরফ্যাশন');
  assert.equal(toBangla('দৌলতখান', table), 'দৌলতখান'); // Bangla stays as it is
  assert.deepEqual(where(toBangla('ward 15 dhaka south', table)), ['ঢাকা-১০:ward']);
  assert.deepEqual(where(toBangla('Doulatkhan', table)), ['ভোলা-২:upazila']);
});

test('ward numbers: lists, ranges, zero-padded', () => {
  assert.deepEqual(wardNumbers('ঢাকা উত্তর সিটি কর্পোরেশনের ওয়ার্ড- ০৪,১৩,১৪, ও ১৬'), [4, 13, 14, 16]);
  assert.deepEqual(wardNumbers('ঢাকা উত্তর সিটি কর্পোরেশনের ওয়ার্ড ৭ থেকে ১২ পর্যন্ত'), [7, 8, 9, 10, 11, 12]);
  assert.deepEqual(wardNumbers('গাজীপুর সিটি কর্পোরেশনের ১ হতে ৫ নং ওয়ার্ড'), [1, 2, 3, 4, 5]);
  assert.deepEqual(wardNumbers('ঢাকা দক্ষিণ সিটি কর্পোরেশনের ওয়ার্ড- ২৩ থেকে ২৫, ৩৫ ও ৫৭'), [23, 24, 25, 35, 57]);
});

test('a ward inside a "থেকে" range finds its seat', () => {
  assert.deepEqual(where('ঢাকা উত্তর ওয়ার্ড ৯'), ['ঢাকা-১৪:ward']);
  assert.deepEqual(where('ঢাকা উত্তর ওয়ার্ড ১৩'), []);
  assert.deepEqual(where('ঢাকা দক্ষিণ ওয়ার্ড ১৫'), ['ঢাকা-১০:ward']);
});

/* ------------------------------------------------ unions and thanas from the place list */

const NAMES: PlaceNames = {
  unions: [
    ['চরপাতা', 'Charpata', 'দৌলতখান', 'ভোলা'], // in an upazila ভোলা-২ holds whole
    ['কলাতিয়া', 'Kalatia', 'কেরানিগঞ্জ', 'ঢাকা'], // ঢাকা-২ holds কেরানিগঞ্জ except five unions
    ['জিনজিরা', 'Zinzira', 'কেরানিগঞ্জ', 'ঢাকা'], // one of the five: ঢাকা-৩
    ['আশুলিয়া', 'Ashulia', 'সাভার', 'ঢাকা'], // ঢাকা-২ holds only three named unions of সাভার
    ['চরপাতা', 'Charpata', 'নাচোল', 'চাঁপাইনবাবগঞ্জ'], // the same name in another district
  ],
  thanas: [['উত্তরা', 'Uttara', ['s-187'], true]],
};
const at = (q: string) => findSeats(q, SEATS, 12, NAMES).map((m) => `${m.seat.seat}:${m.kind}${m.partial ? '+part' : ''}`);

test('a union the boundary text does not name is found through its upazila', () => {
  assert.deepEqual(at('চরপাতা').sort(), ['চাঁপাইনবাবগঞ্জ-২:union', 'ভোলা-২:union']);
  assert.deepEqual(at('চরপাতা ইউনিয়ন').sort(), ['চাঁপাইনবাবগঞ্জ-২:union', 'ভোলা-২:union']);
});

test('a union of an upazila held "except" some unions goes to that seat, the exceptions do not', () => {
  assert.deepEqual(at('কলাতিয়া'), ['ঢাকা-২:union']);
  assert.deepEqual(at('জিনজিরা'), ['ঢাকা-৩:union']);
});

test('a union of an upazila of which a seat holds only named unions is not in that seat', () => {
  assert.deepEqual(at('আশুলিয়া'), []);
});

test('a union typed in English, and the place it is shown with', () => {
  assert.deepEqual(at('Kalatia'), ['ঢাকা-২:union']);
  assert.deepEqual(at('kalatia union'), ['ঢাকা-২:union']);
  const m = findSeats('কলাতিয়া', SEATS, 12, NAMES)[0]!;
  assert.equal(m.place, 'কলাতিয়া ইউনিয়ন, কেরানিগঞ্জ উপজেলা');
});

test('"<union> <upazila>" or "<union> <district>" picks one of the unions sharing a name', () => {
  assert.deepEqual(at('চরপাতা দৌলতখান'), ['ভোলা-২:union']);
  assert.deepEqual(at('চরপাতা চাঁপাইনবাবগঞ্জ'), ['চাঁপাইনবাবগঞ্জ-২:union']);
  const names: PlaceNames = { unions: [['চরপাতা', 'Charpata', 'দৌলতখান', 'ভোলা', 'Daulatkhan'], ['চরপাতা', 'Charpata', 'নাচোল', 'চাঁপাইনবাবগঞ্জ', 'Nachole']], thanas: [] };
  assert.deepEqual(findSeats('charpata daulatkhan', SEATS, 12, names).map((m) => m.seat.seat), ['ভোলা-২']);
  assert.deepEqual(findSeats('Charpata Nachol', SEATS, 12, names).map((m) => m.seat.seat), ['চাঁপাইনবাবগঞ্জ-২']);
  assert.equal(findSeats('Charpata', SEATS, 12, names).find((m) => m.seat.seat === 'ভোলা-২')?.placeEn, 'Charpata union, Daulatkhan');
});

test('an upazila ranks above the unions of other upazilas that share its name', () => {
  const names: PlaceNames = { unions: [['দৌলতখান', 'Daulatkhan', 'নাচোল', 'চাঁপাইনবাবগঞ্জ']], thanas: [] };
  assert.deepEqual(findSeats('দৌলতখান', SEATS, 12, names).map((m) => `${m.seat.seat}:${m.kind}`), ['ভোলা-২:upazila', 'চাঁপাইনবাবগঞ্জ-২:union']);
});

test('a thana is found by name, in either script, with "থানা" or without', () => {
  assert.deepEqual(at('উত্তরা'), ['ঢাকা-১৪:thana+part']);
  assert.deepEqual(at('উত্তরা থানা'), ['ঢাকা-১৪:thana+part']);
  assert.deepEqual(at('Uttara thana'), ['ঢাকা-১৪:thana+part']);
});

test('without the place list nothing changes', () => {
  assert.deepEqual(findSeats('চরপাতা', SEATS).length, 0);
  assert.deepEqual(where('দৌলতখান'), ['ভোলা-২:upazila']);
});

test('ঙ and ং are one letter: রাঙ্গুনিয়া finds রাংগুনিয়া', () => {
  const s = [seat(284, 'চট্টগ্রাম-৭', 'চট্টগ্রাম', 'রাংগুনিয়া উপজেলা')];
  assert.deepEqual(findSeats('রাঙ্গুনিয়া', s).map((m) => m.seat.seat), ['চট্টগ্রাম-৭']);
});

test('a hill-district union goes to the seat described as the whole district', () => {
  const s = [seat(299, 'রাংগামাটি', 'রাঙ্গামাটি', 'রাংগামাটি পার্বত্য জেলা'), seat(298, 'খাগড়াছড়ি', 'খাগড়াছড়ি', 'খাগড়াছড়ি পার্বত্য জেলা')];
  const names: PlaceNames = { unions: [['কাপ্তাই', 'Kaptai', 'কাপ্তাই', 'রাঙ্গামাটি']], thanas: [] };
  assert.deepEqual(findSeats('কাপ্তাই', s, 12, names).map((m) => m.seat.seat), ['রাংগামাটি']);
});

test('the text as written: a name run into এবং, ব্যাতীত for ব্যতীত, "X এবং Y উপজেলার নিম্নলিখিত"', () => {
  const s = [
    seat(272, 'নোয়াখালী-৪', 'নোয়াখালী', '(ক)সুবর্ণচরএবং(খ) নোয়াখালী সদর উপজেলা'),
    seat(63, 'সিরাজগঞ্জ-১', 'সিরাজগঞ্জ', '(ক)কাজিপুর এবং(খ) সিরাজগঞ্জ সদর উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১)মেছড়া,(২) রতনকান্দি'),
    seat(64, 'সিরাজগঞ্জ-২', 'সিরাজগঞ্জ', '(ক) নিম্নলিখিত ইউনিয়ন ব্যাতীত সিরাজগঞ্জ সদরঃ- (১)মেছড়া,(২) রতনকান্দি এবং(খ) কামারখন্দ'),
    seat(214, 'নরসিংদী-২', 'নরসিংদী', 'পলাশ এবং নরসিংদী সদর উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১)আমদিয়া,(২) পাঁচদোনা'),
  ];
  const names: PlaceNames = {
    unions: [
      ['চরজাব্বার', 'Char Jabbar', 'সুবর্ণচর', 'নোয়াখালী'],
      ['শিয়ালকোল', 'Shialkol', 'সিরাজগঞ্জ সদর', 'সিরাজগঞ্জ'],
      ['মেছড়া', 'Mechhra', 'সিরাজগঞ্জ সদর', 'সিরাজগঞ্জ'],
      ['ঘোড়াশাল', 'Ghorashal', 'পলাশ', 'নরসিংদী'],
    ],
    thanas: [],
  };
  const seatsOf = (q: string) => findSeats(q, s, 12, names).map((m) => m.seat.seat);
  assert.deepEqual(seatsOf('সুবর্ণচর'), ['নোয়াখালী-৪']);
  assert.deepEqual(seatsOf('চরজাব্বার'), ['নোয়াখালী-৪']);
  assert.deepEqual(seatsOf('শিয়ালকোল'), ['সিরাজগঞ্জ-২']);
  assert.deepEqual(seatsOf('মেছড়া'), ['সিরাজগঞ্জ-১']);
  assert.deepEqual(seatsOf('ঘোড়াশাল'), ['নরসিংদী-২']);
  // পলাশ is whole in নরসিংদী-২, not a part of it.
  assert.deepEqual(findSeats('পলাশ', s).map((m) => `${m.seat.seat}:${m.kind}${m.partial ? '+part' : ''}`), ['নরসিংদী-২:upazila']);
});

test('a union list read past its punctuation, and an upazila spelled a letter apart', () => {
  const s = [
    seat(192, 'গাজীপুর-৩', 'গাজীপুর', '(ক)শ্রীপুর এবং (খ)গাজিপুর সদর উপজেলারঃ মির্জাপুর, ভাওয়াল গড় ও পিরুজালী ইউনিয়ন'),
    seat(82, 'ঝিনাইদহ-৪', 'ঝিনাইদহ', '(ক)কালীগঞ্জ এবং(খ) ঝিনাইদহ সদর উপজেলার (১)নলডাঙ্গা,(২) ঘোড়াশাল,(৩) ফুরসুন্দি ও(৪) মহারাজপুর ইউনিয়ন'),
    seat(2, 'ঠাকুরগাঁও-২', 'ঠাকুরগাঁও', '(ক)বালিয়াডাঙ্গী, (খ) হরিপুর এবং (গ) রানিসংকাইল উপজেলার নিম্নলিখিত ইউনিয়ন সমূহ: (১)ধর্মগড় ও (২)কাশিপুর'),
    seat(3, 'ঠাকুরগাঁও-৩', 'ঠাকুরগাঁও', '(ক)পীরগঞ্জ উপজেলা এবং (খ) নিম্নলিখিত ইউনিয়ন সমূহ ব্যতীত রানিশংকাইল উপজেলা: (১)ধর্মগড় ও(২) কাশিপুর'),
  ];
  const names: PlaceNames = {
    unions: [
      ['মির্জাপুর', 'Mirzapur', 'গাজীপুর সদর', 'গাজীপুর'],
      ['মহারাজপুর', 'Maharajpur', 'ঝিনাইদহ সদর', 'ঝিনাইদহ'],
      ['ফুরসন্দি', 'Fursandi', 'ঝিনাইদহ সদর', 'ঝিনাইদহ'],
      ['ধর্মগড়', 'Dharmagarh', 'রানিশংকাইল', 'ঠাকুরগাঁও'],
      ['নেকমরদ', 'Nekmorod', 'রানিশংকাইল', 'ঠাকুরগাঁও'],
    ],
    thanas: [],
  };
  const seatsOf = (q: string) => findSeats(q, s, 12, names).map((m) => m.seat.seat);
  assert.deepEqual(seatsOf('মির্জাপুর'), ['গাজীপুর-৩']);
  assert.deepEqual(seatsOf('মহারাজপুর'), ['ঝিনাইদহ-৪']);
  assert.deepEqual(seatsOf('ফুরসন্দি'), ['ঝিনাইদহ-৪']);
  assert.deepEqual(seatsOf('ধর্মগড়'), ['ঠাকুরগাঁও-২']);
  assert.deepEqual(seatsOf('নেকমরদ'), ['ঠাকুরগাঁও-৩']);
});

test('a union since taken into a city corporation shows each seat sharing the city, as part', () => {
  const s = [seat(190, 'গাজীপুর-১', 'গাজীপুর', '(ক)কালিয়াকৈর এবং(খ) গাজীপুর সিটি কর্পোরেশনের ১ হতে ১৮ নং ওয়ার্ড'), seat(191, 'গাজীপুর-২', 'গাজীপুর', 'গাজীপুর সিটি কর্পোরেশনের ১৯ হতে ৩৯ নং ওয়ার্ড')];
  const names: PlaceNames = { unions: [['গাছা', 'Gachha', 'গাজীপুর সদর', 'গাজীপুর', 'Gazipur Sadar', ['s-190', 's-191']]], thanas: [] };
  assert.deepEqual(findSeats('গাছা', s, 12, names).map((m) => `${m.seat.seat}:${m.kind}${m.partial ? '+part' : ''}`), ['গাজীপুর-১:union+part', 'গাজীপুর-২:union+part']);
});
