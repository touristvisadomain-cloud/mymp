/** The cabinet, for the app's মন্ত্রিসভা screen. `?lang=en` for English. */
import { cabinet } from '@/lib/app/payload';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, cabinet(appLang(req)));
}
