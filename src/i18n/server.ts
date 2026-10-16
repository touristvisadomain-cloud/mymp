import { lang } from 'next/root-params';
import { isLang, makeT, type Lang, type T } from './core';

/**
 * The language of the page being rendered, for Server Components: read from
 * the /[lang] root segment, so no page has to pass it down. Bangla when the
 * route has no language (the admin, which is Bangla only).
 */
export async function getLang(): Promise<Lang> {
  const v = await lang();
  return isLang(v) ? v : 'bn';
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
