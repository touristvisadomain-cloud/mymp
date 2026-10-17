/**
 * The name the press uses for a member, where it is not the name on
 * Parliament's roll and no rule can derive it.
 *
 * Parliament writes "মোছাঃ নুসরাত তাবাসসুম জ্যোতি"; every newspaper writes
 * "নুসরাত তাবাসসুম", dropping the last name, which the matcher's own short
 * forms (always the end of a name) cannot reach. Each entry here is matched
 * like the official name and is the name the news and video searches ask for,
 * the first Bangla one in front.
 *
 * Only a name that belongs to this one member and is the one the papers
 * actually print goes here, with where it was seen. A short form that two
 * people share would put one's news on the other's page. Editors can add the
 * same kind of name for a single member under Admin → সদস্য → নামের রূপ; this
 * file is for the ones that should hold from the first build.
 */
export const PRESS_NAMES: Record<string, string[]> = {
  // Mst. Nusrat Tabassum Joty, Women's Seat-50 (NCP). Prothom Alo, Daily Star,
  // TBS, Bangla Tribune, Desh Rupantor, Jugantor (owner, 2026-10-17).
  '013035001': ['নুসরাত তাবাসসুম', 'Nusrat Tabassum', 'Nusrat Tabassum Jyoti'],
  // Md. Abul Hasnat, Cumilla-4 (NCP): known everywhere as Hasnat Abdullah
  // (the owner's list of official pages, 2026-09-17, names him so).
  '013025201': ['হাসনাত আবদুল্লাহ', 'Hasnat Abdullah'],
};

/** A member's press names, Bangla first. */
export const pressNamesOf = (id: string): string[] => PRESS_NAMES[id] ?? [];
