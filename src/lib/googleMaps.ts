/**
 * The Maps JavaScript API for the site's maps (SeatMap, ElectionMap): the
 * key, the script loaded once per page in the page's language, and colours for a library
 * that takes them as text. Browser only.
 */

/** Baked in at build when the build had it; otherwise asked of the running site (api/maps-key). */
export const BUILT_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
let keyAsked: Promise<string> | null = null;
export function googleKey(): Promise<string> {
  if (BUILT_KEY) return Promise.resolve(BUILT_KEY);
  keyAsked ??= fetch('/api/maps-key')
    .then((r) => (r.ok ? (r.json() as Promise<{ key?: string }>) : { key: '' }))
    .then((j) => j.key ?? '')
    .catch(() => '');
  return keyAsked;
}

/**
 * The Maps JavaScript API, loaded once per page, in the page's language: the
 * base map's place names and its own buttons follow it. Google can be loaded
 * only once per page, so a second map on the page gets the first one's.
 */
let googleLoading: Promise<typeof google> | null = null;
export function loadGoogle(key: string, lang: 'bn' | 'en' = 'bn'): Promise<typeof google> {
  if (typeof google !== 'undefined' && google.maps) return Promise.resolve(google);
  googleLoading ??= new Promise((resolve, reject) => {
    const cb = '__mympMapsReady';
    (window as unknown as Record<string, () => void>)[cb] = () => resolve(google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=${lang}&region=BD&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps could not be loaded'));
    document.head.appendChild(s);
  });
  return googleLoading;
}

/**
 * Google calls window.gm_authFailure, once, when it refuses the key. Every
 * map on the page wants to know, so each adds its own listener.
 */
const authFailed: (() => void)[] = [];
export function onAuthFailure(fn: () => void): () => void {
  authFailed.push(fn);
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => { for (const f of authFailed) f(); };
  return () => { const i = authFailed.indexOf(fn); if (i >= 0) authFailed.splice(i, 1); };
}

/** A CSS custom property's value, for map libraries that take colours as text. */
export function resolve(color: string): string {
  const v = color.match(/^var\((--[^)]+)\)$/)?.[1];
  return (v && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || color;
}
