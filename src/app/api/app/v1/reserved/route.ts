/** The fifty seats reserved for women: who holds them, by party, and how they are filled (/sangrakkhito-ason). `?lang=en` for English. */
import { reservedSeats } from '@/lib/app/places';
import { appJson, appLang } from '@/lib/app/respond';

export const revalidate = 3600;

export function GET(req: Request) {
  return appJson(req, reservedSeats(appLang(req)));
}
