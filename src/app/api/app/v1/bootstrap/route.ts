/**
 * Everything the mobile app keeps offline: the member list, the parties, the
 * districts. One request on first run, then only when `version` changes.
 * `?lang=en` for the English app.
 *
 * Built from the same snapshot the website's own pages are built from, so the
 * app can never show something the site does not.
 */
import { bootstrap } from '@/lib/app/payload';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, bootstrap(appLang(req)));
}
