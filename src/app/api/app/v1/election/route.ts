/** The 2026 election and the House it produced, for the app's নির্বাচন screen. `?lang=en` for English. */
import { election } from '@/lib/app/election';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, election(appLang(req)));
}
