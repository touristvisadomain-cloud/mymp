/**
 * The Google Maps browser key, read when the site runs rather than when it is
 * built: Dokploy hands environment variables to the running app but not to
 * the build, so a NEXT_PUBLIC_ value baked in at build time came out empty
 * (2026-10-16). The key is a browser key, restricted by Google to mymp.bd and
 * to the Maps JavaScript API, and visible in any page that draws a map anyway.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? process.env.GOOGLE_MAPS_KEY ?? '';
  return NextResponse.json({ key }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
