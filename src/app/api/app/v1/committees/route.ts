/** Parliament's committees, each with its chair and what it does (/committee). `?lang=en` for English. */
import { committeeList } from '@/lib/app/house';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, committeeList(appLang(req)));
}
