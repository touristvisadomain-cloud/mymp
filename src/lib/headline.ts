/**
 * A news headline on an English page. The outlets write in Bangla; once a
 * headline has been translated (lib/feed/translate.ts, Google Translate) its
 * English is shown, and until then the Bangla, marked lang="bn" as before.
 * Bangla pages never call this: they show the outlet's own words.
 *
 * Plain values only, so client and server components share it.
 */
const BANGLA = /[ঀ-৿]/;

/** The one line under a list of headlines on an English page, when any of them is a machine translation. */
export const MACHINE_NOTE = 'Headlines translated automatically from Bangla by Google Translate. Open a story to read the original.';

/** The same, for a single headline's tooltip. */
export const MACHINE_TITLE = 'Translated automatically from Bangla by Google Translate';

export interface ShownHeadline {
  text: string;
  /** "bn" while the headline is still the Bangla original. */
  lang: 'bn' | undefined;
  /** True when the text is a machine translation (not the outlet's own English). */
  machine: boolean;
}

export function englishHeadline(title: string, titleEn?: string | null): ShownHeadline {
  if (titleEn) return { text: titleEn, lang: undefined, machine: titleEn !== title };
  return { text: title, lang: BANGLA.test(title) ? 'bn' : undefined, machine: false };
}

/** Does any of these headlines show a machine translation on an English page? */
export const anyMachine = (links: { title: string; titleEn?: string | null }[]) =>
  links.some((l) => englishHeadline(l.title, l.titleEn).machine);
