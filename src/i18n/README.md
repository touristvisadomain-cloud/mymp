# The English version

Bangla is the site's default and lives at the plain addresses (`/mp/x`).
English lives under `/en` (`/en/mp/x`). Both are built from the same files
under `src/app/[lang]`: `src/proxy.ts` serves a plain address from `/bn`
without changing it, so no Bangla link or bookmark changes.

**The Bangla pages must not change.** Every Bangla string stays exactly as it
was, character for character; English is added beside it.

## The toolkit

| Where | How |
| --- | --- |
| Server Component (page, layout, `generateMetadata`, server-only helper) | `const t = await getT()` from `@/i18n/server` (the component becomes `async`) |
| Client Component (`'use client'`) | `const t = useT()` from `@/i18n/client` |
| Pure code that gets a language passed in | `makeT(lang)` from `@/i18n/core` |

`t` is the same object everywhere:

```ts
t('সব এমপি', 'All MPs')            // the text in the page's language
t.en / t.lang                      // true on English pages / 'bn' | 'en'
t.n(12)                            // "১২" | "12"        (replaces bn(x))
t.group(127711899)                 // "১২,৭৭,১১,৮৯৯" | "127,711,899" (replaces bnGroup)
t.fixed(12.345, 1)                 // "১২.৩" | "12.3"
t.date('2026-02-17')               // "১৭ ফেব্রুয়ারি ২০২৬" | "17 February 2026" (replaces dateBn)
t.monthYear(iso), t.month(2), t.weekday(0)
t.count(5, 'টি আসন', 'seat', 'seats')  // "৫টি আসন" | "5 seats"
t.ord(13)                          // "১৩" | "13th"
t.href('/mp/x')                    // "/mp/x" | "/en/mp/x"
t.pick(a, b)                       // any value by language
```

Links: `import Link from '@/i18n/Link'` instead of `next/link`. It adds `/en`
on English pages and leaves outside links, files, `/api` and `/admin` alone.
A plain `<a href="/...">` to a page of the site takes `t.href(...)`; so does
`router.push(...)`. Absolute URLs for sharing: `${siteUrl}${t.href(path)}`.

Server Components may pass `t` to other Server Components as a prop. A Client
Component cannot receive `t` (a function); give it nothing and let it call
`useT()`, or pass plain English/Bangla strings already chosen.

## Names of things (`@/i18n/names`)

Never write a name's English yourself; the data has it.

- `personName(m, t.lang)`: a member's or any person's name (`nameBn` / `nameEn`, with the source's capitals and garbles fixed). `otherName(m, t.lang)` is the other language's, for a subtitle.
- `seatName(seat, t.lang)`: "পঞ্চগড়-২" / "Panchagarh-2"; reserved seats "Women's Seat-1".
- `districtName(d, t.lang)` for `districtOf()` / `districtGroups()` results; `districtNameEn(en)`.
- `partyName(p, t.lang)` (full), `partyShort(p, t.lang)` (chips), `partyByAbbr(abbr, nameBn, lang, short?)`, `noParty(lang)`.
- `committeeName(c, t.lang)`, `committeeRole(role, lang)`, `COMMITTEE_TYPE[type][lang]`.
- `OFFICE[key][lang]`, `HOUSE_ROLE[role][lang]`, `govPost(bn, lang)`.
- `ordinalWord(13, lang)`: "ত্রয়োদশ" / "13th".
- `outletName(sourceNameBn, lang)`: a news outlet.

## Text the sources write only in Bangla (`@/i18n/content`, server only)

Biographies, seat boundaries, professions, schools, birthplaces, party posts,
ministries, notes beside election results. Their English is in
`data/translations/en/*.json`, keyed by the exact Bangla.

- `inLang(bnText, t.lang)`: the Bangla on a Bangla page; its English, or **null**, on an English page. When null, leave the field out on the English page; never show the Bangla in its place.
- `translated(bnText, t.lang)`: the same with a flag. Under translated running text (a biography, a boundary) put `<TranslatedNote bnHref={'/mp/x'} />` from `@/components/ui`: "Translated from Bangla. Read the original".

## Text that stays in Bangla on English pages

News headlines and excerpts (`titleBn`, `excerptBn`): they are the outlets'
own words. Mark the element `lang="bn"`. Nothing else.

## Metadata

`export const metadata` becomes:

```ts
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('রাজনৈতিক দল', 'Political parties'),
    description: t('…', '…'),
    alternates: langAlternates(t.lang, '/dol'),
    openGraph: shareGraph('/dol', undefined, t.lang),
  };
}
```

`langAlternates` and `shareGraph` are in `@/lib/seo`. A page with params keeps
its `generateMetadata(props)` and adds `const t = await getT()`.

## English style

- British spelling (centre, organisation, programme, labour), sentence case
  for headings and buttons ("Reserved seats for women", "See all").
- Plain and exact. Translate what the Bangla says; add nothing, drop nothing,
  soften nothing. Numbers, dates and names must match the Bangla exactly.
- Digits are Latin; thousands take commas (`t.group`). Dates "17 February 2026".
- English needs plurals: `t.count(n, 'টি আসন', 'seat', 'seats')`, or `plural(n, one, many)` from `@/i18n/core`.
- No Bangla script in an English string, ever.

### Glossary

| Bangla | English |
| --- | --- |
| আমার এমপি | My MP |
| জাতীয় সংসদ | Parliament (the Jatiya Sangsad); "Parliament of Bangladesh" in full |
| ত্রয়োদশ জাতীয় সংসদ | 13th Parliament |
| সংসদ সদস্য, এমপি | Member of Parliament, MP |
| আসন, নির্বাচনী এলাকা | seat, constituency |
| সাধারণ আসন / নির্বাচিত আসন | general seat / elected seat |
| সংরক্ষিত নারী (মহিলা) আসন | reserved seat for women |
| দল, রাজনৈতিক দল / স্বতন্ত্র | party, political party / independent |
| মন্ত্রিসভা | Cabinet |
| প্রধানমন্ত্রী, মন্ত্রী, প্রতিমন্ত্রী, উপমন্ত্রী | Prime Minister, Minister, State Minister, Deputy Minister |
| উপদেষ্টা, প্রধানমন্ত্রীর উপদেষ্টা | Adviser, Adviser to the Prime Minister |
| পদমর্যাদা | rank (e.g. "with the rank of a minister") |
| মন্ত্রণালয়, বিভাগ (সরকারি) | ministry, division |
| স্পিকার, ডেপুটি স্পিকার | Speaker, Deputy Speaker |
| সংসদ নেতা, বিরোধীদলীয় নেতা | Leader of the House, Leader of the Opposition |
| চিফ হুইপ, হুইপ | Chief Whip, Whip |
| সংসদীয় কমিটি, স্থায়ী কমিটি | parliamentary committee, standing committee |
| সভাপতি (কমিটির) | chair |
| অধিবেশন, বৈঠক | session, sitting |
| দিনের কার্যসূচি | order of the day |
| প্রজ্ঞাপন, পরিপত্র, গেজেট | notification, circular, gazette |
| নির্বাচন কমিশন, ভোটার, ভোটকেন্দ্র | Election Commission, voters, polling centres |
| শপথ | oath |
| বিভাগ (প্রশাসনিক), জেলা, উপজেলা, ইউনিয়ন | division, district, upazila, union |
| সিটি কর্পোরেশন, পৌরসভা, ওয়ার্ড | city corporation, municipality (pourashava), ward |
| প্রতীক (নির্বাচনী) | (electoral) symbol |
| মুক্তিযোদ্ধা | freedom fighter (of the 1971 Liberation War) |
| সূত্র, তথ্যসূত্র | source, sources |
| যাচাই করা / যাচাই হয়নি | checked, verified / not verified |
| হালনাগাদ | updated |
| সংশোধন জানান | Report a correction |
| সংবাদ | News |
| পরিসংখ্যান | Statistics |
| জীবনী | biography |
| পেশা, শিক্ষা, জন্মস্থান | profession, education, birthplace |

## Checking

- `npx tsc --noEmit -p .` and `npx eslint <files>`.
- `MSYS_NO_PATHCONV=1 node scripts/i18n-check.mjs http://localhost:3000 /dol /mp/x`: Bangla left on the English pages (none allowed outside `lang="bn"`).
- `node scripts/i18n-bn-intact.mjs`: every Bangla string of the original files is still in the converted ones.
