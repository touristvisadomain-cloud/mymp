import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSeats, placeNames, type FinderSeat } from '../findSeat';

// Boundary text as the Election Commission writes it (data/seats.json, 2026).
const seat = (no: number, name: string, district: string, boundary: string): FinderSeat => ({
  no, seat: name, seatEn: null, slug: `s-${no}`, district, districtEn: null, boundary, member: null,
});
const SEATS = [
  seat(175, 'ঢাকা-২', 'ঢাকা', '(ক)নিম্নলিখিত ইউনিয়ন সমূহ ব্যতীত কেরানিগঞ্জ উপজেলাঃ(১) জিনজিরা, (২)আগানগর,(৩) তেঘরিয়া,(৪) কোন্ডা ও(৫) শুভাট্যা, (খ)ঢাকা দক্ষিন সিটি কর্পোরেশনের ওয়ার্ড ৫৫,৫৬, ও ৫৭ এবং (গ)সাভার উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ(১) আমিনবাজার,(২) তেতুলঝড়া ও(৩) ভাকুর্তা'),
  seat(176, 'ঢাকা-৩', 'ঢাকা', 'কেরানিগঞ্জ উপজেলার নিম্নলিখিত ইউনিয়ন সমূহঃ (১) জিনজিরা, (২) আগানগর, (৩) তেঘরিয়া, (৪) কোন্ডা ও (৫) শুভাট্যা'),
  seat(183, 'ঢাকা-১০', 'ঢাকা', 'ঢাকা দক্ষিন সিটি কর্পোরেশনের ওয়ার্ড- ১৪,১৫,১৬,১৭,১৮ ও ২২'),
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
