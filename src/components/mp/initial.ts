import { initial, type Member } from '@/lib/data';
import { personName } from '@/i18n/names';
import type { Lang } from '@/i18n/core';

/** Titles before a name that the avatar letter skips, as initial() skips "মোঃ", "ড." and the like in Bangla. */
const TITLE_EN = /^(?:md\.?|mst\.?|mohd\.?|barrister|dr\.?|advocate|adv\.?|prof\.?|professor|engr\.?|alhaj|al-haj)\s+/i;

/** The letter on a member's avatar when the photo will not load: the Bangla name's first letter, or the English name's. */
export function memberInitial(m: Member, lang: Lang): string {
  if (lang === 'bn') return initial(m);
  let name = personName(m, 'en').trim();
  for (let i = 0; i < 3 && TITLE_EN.test(name); i++) name = name.replace(TITLE_EN, '');
  const letter = name.match(/[A-Za-z]/)?.[0];
  return letter ? letter.toUpperCase() : '';
}
