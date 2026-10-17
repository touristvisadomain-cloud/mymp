/**
 * How every route of the mobile app's API answers: the language a request
 * asks for, and the response itself.
 *
 * The language is `?lang=bn` (the default) or `?lang=en`. The fields keep the
 * names the first app versions read (`nameBn`, `seatBn`…); on an English
 * response they carry the English, and a text with no English yet is null,
 * never the Bangla in its place. News headlines are the one exception: the
 * English (machine-translated) when there is some, the outlet's own Bangla
 * until then, never null, with the original beside it (docs/app-api.md).
 *
 * Every response may be read from any origin (the app's web build runs on
 * another), is cached at the edge for as long as the route says, and is
 * gzipped for a client that accepts it.
 */
import { NextResponse } from 'next/server';
import { gzipJson } from '@/lib/gzipJson';
import type { Lang } from '@/i18n/core';

/** An hour at the edge, then up to a day stale while it refreshes: the snapshot changes with a build at most. */
export const DAILY = 'public, s-maxage=3600, stale-while-revalidate=86400';
/** Five minutes, as the news pages have. */
export const LIVE = 'public, s-maxage=300, stale-while-revalidate=1800';

/** The language a request asks for: `?lang=en`, or Bangla for anything else. */
export const appLang = (req: Request): Lang => (new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'bn');

const BANGLA = /[ঀ-৿]/;

/** English text, or null while it is still Bangla: an English response never carries Bangla in its place. */
export const enOnly = (s: string | null | undefined): string | null => (s && !BANGLA.test(s) ? s : null);

/** The text in the response's language: as it is in Bangla, or only if it really is English. */
export const inResponse = (s: string | null | undefined, lang: Lang): string | null => (lang === 'en' ? enOnly(s) : s ?? null);

/** A JSON answer with the API's headers, gzipped when the client accepts it. */
export function appJson(req: Request, body: unknown, opts: { status?: number; cache?: string } = {}): Promise<Response> {
  const res = NextResponse.json(body, {
    status: opts.status ?? 200,
    headers: {
      'cache-control': opts.status && opts.status >= 400 ? 'public, s-maxage=60' : opts.cache ?? DAILY,
      'access-control-allow-origin': '*',
    },
  });
  return gzipJson(req, res);
}

/** The API's "not found", with the same headers. */
export const notFound = (req: Request) => appJson(req, { error: 'not found' }, { status: 404 });
