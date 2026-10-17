/**
 * A headline or a summary as plain text.
 *
 * Some outlets put HTML in their feeds' text, and some encode it twice, so
 * that one round of decoding brings the tags back: summaries showed
 * `<p style="text-align: justify;">…` and titles ended in "&nbsp;". Bangla
 * text also carries "&zwj;" (র‍্যাব). So tags go, entities are decoded, and
 * both are done again for the twice-encoded, before anything is stored.
 */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
  zwj: '‍', zwnj: '‌', shy: '',
};

const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });

const untag = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<\/?[a-z][^>]*>/gi, ' ');

export function cleanText(s: string): string {
  let t = s;
  for (let i = 0; i < 2; i++) t = decode(untag(t));
  return untag(t).replace(/\s+/g, ' ').trim();
}

/** Whether stored text still has tags or entities in it. */
export const hasMarkup = (s: string | null | undefined) => !!s && /<\/?[a-z][^>]*>|&(#x?[0-9a-f]+|[a-z]+);/i.test(s);
