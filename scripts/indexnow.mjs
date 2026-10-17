#!/usr/bin/env node
/**
 * Tells the search engines that take IndexNow (Bing, which ChatGPT search and
 * Copilot read from, plus Yandex, Seznam and Naver) that the site's pages have
 * changed, so they fetch them again within hours rather than whenever they
 * next come round. Google does not take IndexNow; it reads the sitemap.
 *
 *   npm run seo:indexnow                 every address in the live sitemap
 *   npm run seo:indexnow -- /mp/x /ason/dhaka-17   just these (both languages)
 *   npm run seo:indexnow -- --dry        list what would be sent, send nothing
 *
 * Run it after a deploy that changes many pages. The key is public by design:
 * the engines check it at https://mymp.bd/<key>.txt to confirm the site sent it.
 */
const KEY = '3be4a24ba7de4137027f6468f8054cdd';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mymp.bd').replace(/\/$/, '');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const paths = args.filter((a) => a.startsWith('/'));

async function sitemapUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

const urls = paths.length
  ? paths.flatMap((p) => [`${SITE}${p === '/' ? '' : p}`, `${SITE}/en${p === '/' ? '' : p}`])
  : await sitemapUrls();

console.log(`${urls.length} addresses${dry ? ' (dry run, nothing sent)' : ''}`);
if (dry) {
  console.log(urls.slice(0, 20).join('\n') + (urls.length > 20 ? `\n… and ${urls.length - 20} more` : ''));
  process.exit(0);
}

// One request takes up to 10,000 addresses.
for (let i = 0; i < urls.length; i += 10000) {
  const urlList = urls.slice(i, i + 10000);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
  });
  // 200 and 202 both mean accepted; 403 means the key file is not live yet.
  console.log(`${urlList.length} sent: HTTP ${res.status}${res.ok ? '' : ` ${await res.text()}`}`);
  if (!res.ok) process.exitCode = 1;
}
