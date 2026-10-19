/**
 * The places a seat covers, shortened from the Election Commission's boundary
 * text for a card or a list: "(ক) পঞ্চগড় সদর, (খ) তেঁতুলিয়া এবং (গ)আটোয়ারী
 * উপজেলা" → "পঞ্চগড় সদর, তেঁতুলিয়া ও আটোয়ারী উপজেলা". In Bangla only, as the text is.
 */
export function seatArea(boundary: string | null | undefined): string | null {
  if (!boundary) return null;
  const s = boundary
    .replace(/\([ক-হ]\)\s*/g, '')
    .replace(/\([০-৯\d]+\)\s*/g, '')
    .replace(/\s*এবং\s*/g, ' ও ')
    .replace(/\s*ঃ\s*-?/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}
