/** The sessions of Parliament, their sittings and circulars, the notices and the presiding officers (/odhibeshon). `?lang=en` for English. */
import { sessionsView } from '@/lib/app/house';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, sessionsView(appLang(req)));
}
