/**
 * Development only: English headlines for a few feed items from a local file,
 * to see the English pages as they will look once the translator has run,
 * without the database's English columns and without a translation key.
 *
 *   .dev/feed-en.json   { "<feed item id>": { "titleEn": "…", "summaryEn": "…" } }
 *
 * `.dev/` is not committed. Never read outside `next dev`: in production, in
 * the build and in scripts this returns null without touching the disk.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Entry = { titleEn?: string; summaryEn?: string };

let cache: { mtime: number; data: Record<string, Entry> } | null = null;

export function devEnglish(id: number): Entry | null {
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const file = join(process.cwd(), '.dev', 'feed-en.json');
    const mtime = statSync(file).mtimeMs;
    if (!cache || cache.mtime !== mtime) cache = { mtime, data: JSON.parse(readFileSync(file, 'utf8')) as Record<string, Entry> };
    return cache.data[String(id)] ?? null;
  } catch {
    return null;
  }
}
