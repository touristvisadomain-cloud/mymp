/**
 * `results:2026`: 2026 general-election results for every territorial seat,
 * from two published sources, for mymp.bd's election_results:
 *
 * - The Business Standard's Election 2026 page (see results-tbs.ts): every
 *   candidate and count for about 297 seats, in one request. Used first.
 * - Wikipedia's constituency articles: used where TBS has no final count,
 *   and as a check on TBS everywhere else; the note says whether the winner's
 *   count agrees, and gives Wikipedia's when it does not.
 *
 * Neither is the Election Commission's gazette, and every note says so.
 *
 * The owner chose this route (2026-09-11) because ecs.gov.bd answers bots
 * with a challenge, which nothing here works around. Wikipedia is read
 * through /wiki/<title>?action=raw (the raw path its robots.txt allows), one
 * request per second per host, Bangla first, then English. Only the "General election 2026" results box counts:
 * by-election boxes and boxes without real vote counts are skipped. Each
 * draft carries the article's link and the date it was read. Rows that already exist in
 * mymp.bd (an editor's draft or a published result) are never touched, except
 * by `results:wikipedia:refresh`, which rewrites this job's own rows that no
 * editor has saved since.
 *
 * When the 2026 winner is not the seat's sitting member, the draft says why
 * where the article shows it (a 2026 by-election box whose winner is the
 * sitting member), or says plainly that the names differ. Seats where the two
 * are one person under different spellings are listed, with the evidence, in
 * config/results-reviewed.json.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { and, eq, lte } from 'drizzle-orm';
import { schema } from '@sangsad/db';
import { bnDigits, mayFetch, nameSimilarity, normalise, politeGet, toLatinDigits } from '@sangsad/shared';
import type { Db } from './parliament-core';
import { fetchTbs } from './results-tbs';

const { constituencies, memberTerms, members, parliaments, parties } = schema;

const HONORIFICS = new Set(['মো', 'মুহাম্মদ', 'ডা', 'ড', 'ব্যারিস্টার', 'অ্যাডভোকেট', 'আলহাজ্ব', 'বেগম', 'প্রফেসর', 'ইঞ্জিনিয়ার'].map((w) => normalise(w)));
const bnTokens = (s: string) => normalise(s).replace(/\s+/g, ' ').split(' ').filter((t) => t && !HONORIFICS.has(t));

/** Whether a Wikipedia winner and a sitting member are the same person, allowing for spelling. */
export function sameName(wikiName: string, nameBn: string | null, nameEn: string | null): boolean {
  if (nameEn && /[A-Za-z]/.test(wikiName) && nameSimilarity(wikiName, nameEn) >= 0.8) return true;
  if (!nameBn) return false;
  const a = bnTokens(wikiName.replace(/\./g, ' '));
  const b = bnTokens(nameBn.replace(/\./g, ' '));
  if (!a.length || !b.length) return false;
  if (a.join('') === b.join('')) return true;
  // Compare consonant skeletons: vowel signs are where spellings of one name differ (মজিবুর / মজিবর).
  const skel = (t: string) => t.replace(/[ঁ-ঃা-্ৗ]/g, '');
  const setB = new Set(b.map(skel));
  return a.filter((t) => setB.has(skel(t))).length / Math.min(a.length, b.length) >= 0.75;
}

export interface WikiCandidate {
  name: string;
  party: string | null;
  votes: number;
}
export interface WikiResult {
  candidates: WikiCandidate[];
  turnout: number | null;
  title: string;
}

/* ---------------- wikitext parsing ---------------- */

/** Splits a template body on its top-level pipes, leaving [[a|b]] and nested {{…}} intact. */
export function splitParams(body: string): string[] {
  const out: string[] = [];
  let depthLink = 0;
  let depthTpl = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '[[') { depthLink++; cur += two; i++; continue; }
    if (two === ']]') { depthLink = Math.max(0, depthLink - 1); cur += two; i++; continue; }
    if (two === '{{') { depthTpl++; cur += two; i++; continue; }
    if (two === '}}') { depthTpl = Math.max(0, depthTpl - 1); cur += two; i++; continue; }
    if (body[i] === '|' && depthLink === 0 && depthTpl === 0) { out.push(cur); cur = ''; continue; }
    cur += body[i];
  }
  out.push(cur);
  return out;
}

/** Plain text from a wikitext value: links reduced to their label, refs, templates and markup removed. */
export function plain(value: string): string {
  return value
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const numberOf = (v: string | undefined): number | null => {
  if (!v) return null;
  const s = toLatinDigits(plain(v)).replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

/** Top-level {{…}} templates in a stretch of wikitext, as name + params. */
export function templates(text: string): { name: string; params: Record<string, string> }[] {
  const out: { name: string; params: Record<string, string> }[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text.slice(i, i + 2) !== '{{') continue;
    let depth = 0;
    let j = i;
    for (; j < text.length; j++) {
      if (text.slice(j, j + 2) === '{{') { depth++; j++; continue; }
      if (text.slice(j, j + 2) === '}}') { depth--; j++; if (depth === 0) break; }
    }
    const body = text.slice(i + 2, j - 1);
    const [head = '', ...rest] = splitParams(body);
    const params: Record<string, string> = {};
    rest.forEach((p, k) => {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
      else params[String(k + 1)] = p.trim();
    });
    out.push({ name: head.trim().toLowerCase(), params });
    i = j;
  }
  return out;
}

const BY_ELECTION = /by-?election|উপ-?নির্বাচন/i;
const GENERAL_2026 = /(2026|২০২৬|ত্রয়োদশ)/;

/** The 2026 general-election results box of an article, or null when there is none with real votes. */
export const parse2026 = (wikitext: string) => parseBox(wikitext, 'general');
/** A 2026 by-election results box, when the article has one with real votes. */
export const parseBy2026 = (wikitext: string) => parseBox(wikitext, 'by');

function parseBox(wikitext: string, kind: 'general' | 'by'): WikiResult | null {
  const starts = [...wikitext.matchAll(/\{\{\s*Election box begin/gi)].map((m) => m.index!);
  for (const [k, start] of starts.entries()) {
    // A box ends at its own "end" template, or where the next box or section
    // begins when an editor left the end out; otherwise one election's
    // candidates would run into the next one's.
    const rest = wikitext.slice(start, starts[k + 1] ?? wikitext.length);
    const stops = [rest.search(/\{\{\s*Election box end\s*\}\}/i), rest.search(/\n=+[^=\n]+=+[ \t]*(\n|$)/)].filter((n) => n > 0);
    const block = stops.length ? rest.slice(0, Math.min(...stops)) : rest;
    const tpls = templates(block);
    const begin = tpls.find((t) => t.name.startsWith('election box begin'));
    const title = plain(begin?.params.title ?? '');
    if (!GENERAL_2026.test(title) || BY_ELECTION.test(title) !== (kind === 'by')) continue;
    const candidates: WikiCandidate[] = [];
    let turnout: number | null = null;
    for (const t of tpls) {
      if (/^election box (winning )?candidate/.test(t.name)) {
        const name = plain(t.params.candidate ?? '');
        const votes = numberOf(t.params.votes);
        if (!name || /^tbd$/i.test(name) || votes === null) continue;
        candidates.push({ name, party: plain(t.params.party ?? '') || null, votes });
      } else if (t.name.startsWith('election box turnout')) {
        turnout = numberOf(t.params.percentage);
      }
    }
    const real = candidates.filter((c) => c.votes > 0);
    if (real.length >= 2) return { candidates: real.sort((a, b) => b.votes - a.votes), turnout: turnout && turnout > 0 && turnout <= 100 ? turnout : null, title };
  }
  return null;
}

/* ---------------- fetching ---------------- */

export interface WikiPage {
  title: string;
  wikitext: string;
}

export const pageUrl = (host: string, title: string) => `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/**
 * Each article's wikitext through /wiki/<title>?action=raw, the one raw path
 * Wikipedia's robots.txt allows (it disallows /w/ and /api/, so the API is
 * not used). A redirect is followed once.
 */
export async function fetchPages(host: string, titles: string[], cacheName = 'seats'): Promise<Map<string, WikiPage>> {
  // Development only: WIKI_CACHE_DIR keeps one run's pages so a re-run reads no network.
  const cacheFile = process.env.WIKI_CACHE_DIR ? resolve(process.env.WIKI_CACHE_DIR, `${host}-${cacheName}.json`) : null;
  if (cacheFile && existsSync(cacheFile)) return new Map(Object.entries(JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, WikiPage>));
  const out = await fetchPagesLive(host, titles);
  if (cacheFile) writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(out)));
  return out;
}

async function fetchPagesLive(host: string, titles: string[]): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (const requested of titles) {
    let title = requested;
    for (let hop = 0; hop < 2; hop++) {
      const url = `${pageUrl(host, title)}?action=raw`;
      const allowed = await mayFetch(url);
      if (!allowed.ok) throw new Error(allowed.why);
      const r = await politeGet(url, 'text/x-wiki,text/plain;q=0.9,*/*;q=0.5');
      if (r.status === 404) break;
      if (r.status !== 200) throw new Error(`${host} HTTP ${r.status} for ${title}`);
      const redirect = r.text.match(/^#(?:REDIRECT|পুনর্নির্দেশ)\s*\[\[([^\]|#]+)/i)?.[1];
      if (redirect && hop === 0) {
        title = redirect.trim();
        continue;
      }
      out.set(requested, { title, wikitext: r.text });
      break;
    }
  }
  return out;
}

/** "Cox'sBazar-1" → "Cox's Bazar-1", the way Wikipedia titles constituencies. */
export const enTitle = (s: string) => s.replace(/([a-z'’])([A-Z])/g, '$1 $2').trim();

/* ---------------- party labels ---------------- */

async function partyLabeller(db: Db) {
  const rows = await db.select({ nameBn: parties.nameBn, nameEn: parties.nameEn, short: parties.shortName }).from(parties);
  const byName = new Map<string, string>();
  for (const p of rows) {
    for (const n of [p.nameBn, p.nameEn]) if (n) byName.set(normalise(n.replace(/\(.*?\)/g, ' ')), p.short);
  }
  const extra: [RegExp, string][] = [
    [/independent|স্বতন্ত্র/i, 'Ind'],
    [/^(bnp|বিএনপি)$/i, 'BNP'],
    [/jamaat|জামায়াত|জামাত/i, 'BJEI'],
    [/national citizen party|জাতীয় নাগরিক পার্টি|এনসিপি/i, 'NCP'],
  ];
  return (label: string | null): string | null => {
    if (!label) return null;
    const hit = byName.get(normalise(label.replace(/\(.*?\)/g, ' ')));
    if (hit) return hit;
    for (const [re, abbr] of extra) if (re.test(label)) return abbr;
    return label;
  };
}

/* ---------------- job ---------------- */

/** Seats where the article's winner and the sitting member were checked to be one person. */
export function reviewedSameWinner(): Map<number, string> {
  const file = resolve(import.meta.dirname, '../../../config/results-reviewed.json');
  const json = JSON.parse(readFileSync(file, 'utf8')) as { sameWinner: Record<string, string> };
  return new Map(Object.entries(json.sameWinner).map(([k, v]) => [Number(k), v]));
}

/** 133215 → "১,৩৩,২১৫" */
const bnCount = (n: number) => bnDigits(n.toLocaleString('en-IN'));

export async function runResults2026(
  db: Db,
  parliamentNumber = 13,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<{ itemsFound: number; itemsNew: number }> {
  const [parl] = await db.select({ id: parliaments.id }).from(parliaments).where(eq(parliaments.number, parliamentNumber));
  if (!parl) throw new Error(`parliament ${parliamentNumber} not seeded`);
  const seats = await db
    .select({ number: constituencies.number, nameBn: constituencies.nameBn, nameEn: constituencies.nameEn })
    .from(constituencies)
    .where(and(eq(constituencies.parliamentId, parl.id), lte(constituencies.number, 300)));

  // The two hosts are read in parallel; each still gets one request per second.
  const [bnPages, enPages] = await Promise.all([
    fetchPages('bn.wikipedia.org', seats.map((s) => s.nameBn)),
    fetchPages('en.wikipedia.org', seats.map((s) => enTitle(s.nameEn))),
  ]);
  const label = await partyLabeller(db);
  const sitting = await db
    .select({ seatNo: constituencies.number, seatBn: constituencies.nameBn, nameBn: members.nameBn, nameEn: members.nameEn })
    .from(memberTerms)
    .innerJoin(members, eq(members.id, memberTerms.memberId))
    .innerJoin(constituencies, eq(constituencies.id, memberTerms.constituencyId))
    .where(and(eq(memberTerms.parliamentId, parl.id), eq(memberTerms.role, 'MP')));
  const mpBySeat = new Map(sitting.map((m) => [m.seatNo, m]));
  const sameWinner = reviewedSameWinner();

  const tbs = await fetchTbs();
  process.stdout.write(`  TBS: ${tbs ? `${tbs.size} seats with a final count` : 'not read'}\n`);
  /** "Bangladesh Nationalist Party (BNP)" → parliament's short name, else the bracketed short form. */
  const tbsParty = (p: string) => {
    const short = p.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
    const full = p.replace(/\([^)]*\)\s*$/, '').trim();
    const mapped = label(full);
    return mapped && mapped !== full ? mapped : (short ?? full);
  };
  const day = new Date().toISOString().slice(0, 10);

  type Check = 'agrees' | 'differs' | 'one-source';
  const drafts: { seatNo: number; seat: string; result: WikiResult; sourceUrl: string; note: string; source: 'tbs' | 'wikipedia'; check: Check; winnerIsMember: boolean }[] = [];
  const missing: string[] = [];
  for (const s of seats.sort((a, b) => a.number - b.number)) {
    const bn = bnPages.get(s.nameBn);
    const en = enPages.get(enTitle(s.nameEn));
    const bnRes = bn ? parse2026(bn.wikitext) : null;
    const enRes = en ? parse2026(en.wikitext) : null;
    const wiki = bnRes ? { res: bnRes, page: bn!, host: 'bn.wikipedia.org', lang: 'বাংলা' } : enRes ? { res: enRes, page: en!, host: 'en.wikipedia.org', lang: 'ইংরেজি' } : null;
    const t = tbs?.get(s.number);
    if (!t && !wiki) {
      missing.push(`${s.number} ${s.nameBn}`);
      continue;
    }
    const mp = mpBySeat.get(s.number);
    const isMember = (name: string) => !!mp && (sameName(name, mp.nameBn, mp.nameEn) || sameWinner.has(s.number));

    let result: WikiResult;
    let sourceUrl: string;
    let note: string;
    let check: Check = 'one-source';
    if (t) {
      result = { title: `TBS: ${t.seatName}`, turnout: null, candidates: t.candidates.map((c) => ({ name: c.name, party: tbsParty(c.party), votes: c.votes })) };
      sourceUrl = t.url;
      note = `উৎস: দ্য বিজনেস স্ট্যান্ডার্ড, নির্বাচন ২০২৬ পাতা, ${day} তারিখে পড়া। নির্বাচন কমিশনের গেজেটের সঙ্গে মিলিয়ে দেখা হয়নি।`;
      for (const n of t.notes) note += ` ${n}`;
      if (t.withoutVotes) note += ` উৎসে ${bnDigits(t.withoutVotes)} জন প্রার্থীর ভোটের সংখ্যা নেই।`;
      if (wiki) {
        const w = wiki.res.candidates[0]!;
        const samePerson = isMember(w.name) && isMember(t.candidates[0]!.name);
        if (w.votes === t.candidates[0]!.votes) {
          check = 'agrees';
          note += ' উইকিপিডিয়াতেও বিজয়ীর ভোট একই।';
        } else {
          check = 'differs';
          note += samePerson
            ? ` উইকিপিডিয়ায় (${wiki.lang}) বিজয়ীর ভোট ${bnCount(w.votes)}।`
            : ` উইকিপিডিয়ায় (${wiki.lang}) বিজয়ী ${w.name}, ভোট ${bnCount(w.votes)}।`;
        }
      }
    } else {
      const w = wiki!;
      result = { ...w.res, candidates: w.res.candidates.map((c) => ({ ...c, party: label(c.party) })) };
      sourceUrl = pageUrl(w.host, w.page.title);
      note = `উৎস: উইকিপিডিয়া (${w.lang}), নিবন্ধ «${w.page.title}», ${day} তারিখে পড়া। নির্বাচন কমিশনের গেজেটের সঙ্গে মিলিয়ে দেখা হয়নি।`;
      if (bnRes && enRes && bnRes.candidates[0]!.votes !== enRes.candidates[0]!.votes) {
        note += ` ইংরেজি উইকিপিডিয়ায় বিজয়ীর ভোট ${bnCount(enRes.candidates[0]!.votes)}, বাংলায় ${bnCount(bnRes.candidates[0]!.votes)}।`;
      }
    }

    const candidates = result.candidates;
    const winner = candidates[0]!;
    const winnerIsMember = isMember(winner.name);
    if (mp && winnerIsMember) {
      // The same person: show the winner under the official Bangla name.
      candidates[0] = { ...winner, name: mp.nameBn };
    } else if (mp) {
      const elsewhere = sitting.find((o) => o.seatNo !== s.number && sameName(winner.name, o.nameBn, o.nameEn));
      if (elsewhere) candidates[0] = { ...winner, name: elsewhere.nameBn };
      const by = [
        { page: bn, lang: 'বাংলা' },
        { page: en, lang: 'ইংরেজি' },
      ]
        .map(({ page, lang }) => ({ res: page ? parseBy2026(page.wikitext) : null, lang }))
        .find(({ res }) => res && sameName(res.candidates[0]!.name, mp.nameBn, mp.nameEn));
      if (by?.res) {
        note += ` এটি ২০২৬ সালের সাধারণ নির্বাচনের ফল। পরে উপনির্বাচনে ${mp.nameBn} ${bnCount(by.res.candidates[0]!.votes)} ভোট পেয়ে এই আসনের সংসদ সদস্য হন (উইকিপিডিয়া, ${by.lang})।`;
        if (elsewhere) note += ` সাধারণ নির্বাচনের বিজয়ী ${elsewhere.nameBn} এখন ${elsewhere.seatBn} আসনের সংসদ সদস্য।`;
      } else {
        note += ` বিজয়ীর নাম এই আসনের বর্তমান সংসদ সদস্য ${mp.nameBn}-এর সঙ্গে মেলেনি; উপনির্বাচন হয়ে থাকতে পারে, অথবা তথ্যটি ভুল।`;
      }
    }
    drafts.push({ seatNo: s.number, seat: s.nameBn, result: { ...result, candidates }, sourceUrl, note, source: t ? 'tbs' : 'wikipedia', check, winnerIsMember });
  }

  const report = resolve(import.meta.dirname, `../../../docs/reports/results-${day}.json`);
  const count = (fn: (d: (typeof drafts)[number]) => boolean) => drafts.filter(fn).length;
  const summary = {
    seats: drafts.length,
    fromTbs: count((d) => d.source === 'tbs'),
    fromWikipedia: count((d) => d.source === 'wikipedia'),
    winnerCountAgrees: count((d) => d.check === 'agrees'),
    winnerCountDiffers: count((d) => d.check === 'differs'),
    oneSourceOnly: count((d) => d.check === 'one-source'),
    winnerNotSittingMember: count((d) => !d.winnerIsMember),
    missing,
  };
  writeFileSync(report, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary, items: drafts }, null, 1));
  process.stdout.write(`  results: ${JSON.stringify({ ...summary, missing: missing.length })}; report ${report}\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    process.stdout.write('  not written to mymp.bd (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)\n');
    return { itemsFound: seats.length, itemsNew: 0 };
  }
  const mymp = createClient(url, key, { auth: { persistSession: false } });
  const { data: existing, error } = await mymp
    .from('election_results')
    .select('seat_no,status,source_url,created_by,updated_by')
    .eq('parliament_no', parliamentNumber);
  if (error) throw new Error(`mymp election_results read: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => r.seat_no as number));

  if (refresh) {
    // Only this job's own rows: from its two sources, and never saved by an editor.
    const ours = new Set(
      (existing ?? [])
        .filter((r) => !r.created_by && !r.updated_by && /wikipedia\.org|tbsnews\.net/.test(r.source_url as string))
        .map((r) => r.seat_no as number),
    );
    let updated = 0;
    for (const d of drafts.filter((x) => ours.has(x.seatNo))) {
      const { error: updateError } = await mymp
        .from('election_results')
        .update({
          candidates: d.result.candidates,
          turnout: d.result.turnout,
          source_url: d.sourceUrl,
          source_note: d.note,
          updated_at: new Date().toISOString(),
        })
        .eq('seat_no', d.seatNo)
        .eq('parliament_no', parliamentNumber);
      if (updateError) throw new Error(`mymp election_results update: ${updateError.message}`);
      updated++;
    }
    process.stdout.write(`  mymp.bd: ${updated} of this job's rows rewritten; rows an editor saved were left alone\n`);
  }
  const rows = drafts
    .filter((d) => !have.has(d.seatNo))
    .map((d) => ({
      seat_no: d.seatNo,
      parliament_no: parliamentNumber,
      candidates: d.result.candidates,
      total_votes: null,
      turnout: d.result.turnout,
      source_url: d.sourceUrl,
      source_note: d.note,
      status: 'draft',
    }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error: insertError } = await mymp.from('election_results').insert(rows.slice(i, i + 50));
    if (insertError) throw new Error(`mymp election_results insert: ${insertError.message}`);
  }
  process.stdout.write(`  mymp.bd: ${rows.length} drafts written, ${drafts.length - rows.length} seats already had a row\n`);
  return { itemsFound: seats.length, itemsNew: rows.length };
}
