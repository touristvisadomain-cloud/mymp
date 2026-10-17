/**
 * The newspaper's own address behind a Google News link.
 *
 * Google News' search feed (the hourly search, feed:fill) gives every story as
 * news.google.com/rss/articles/<id>, not the outlet's page. Stored as it is,
 * the story's picture could not be found (the thumbnail job read Google's page,
 * which names none), the reader went through Google, and the same story from
 * the outlet's own feed did not look like the same address.
 *
 * The id no longer carries the address in plain base64. Google's article page
 * gives a signature and a timestamp for it, and its own batchexecute call,
 * the one the page makes when opened, answers with the outlet's address. Two
 * requests a story, made only for a story not already stored.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const isGoogleNewsLink = (url: string): boolean => /^https?:\/\/news\.google\.com\/(rss\/)?(articles|read)\//i.test(url);

/** The outlet's address, or null when Google does not give it (the caller keeps the link it had). */
export async function resolveGoogleNews(url: string, timeoutMs = 8_000): Promise<string | null> {
  if (!isGoogleNewsLink(url)) return url;
  const id = new URL(url).pathname.split('/').pop();
  if (!id) return null;
  try {
    const page = await fetch(`https://news.google.com/rss/articles/${id}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs),
    }).then((r) => (r.ok ? r.text() : ''));
    const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const inner = JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(ts),
      sg,
    ]);
    const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
      body: 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]])),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const chunk = (await res.text()).split('\n\n')[1];
    if (!chunk) return null;
    const answer = JSON.parse(JSON.parse(chunk)[0][2]) as [string, string];
    const out = answer?.[1];
    return typeof out === 'string' && /^https?:\/\//.test(out) && !isGoogleNewsLink(out) ? out : null;
  } catch {
    return null;
  }
}
