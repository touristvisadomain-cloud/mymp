/** Every seat, with its district, its area and whether it is filled (/ason). `?lang=en` for English. */
import { seatList } from '@/lib/app/places';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, seatList(appLang(req)));
}
