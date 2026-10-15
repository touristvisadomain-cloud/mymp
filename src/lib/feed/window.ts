/**
 * The window the site's news covers (owner, 2026-10-15): from December 2025,
 * when the 13th parliament's election campaign began, to today. Older stories
 * stay in the table but are shown nowhere: not on the news page, not on a
 * member's page, not in a month list, not to the app.
 *
 * Kept apart from store.ts, which is server code, so the date picker in the
 * browser can stop at the same day.
 */
export const FEED_FROM = '2025-12-01';
export const FEED_FROM_MONTH = FEED_FROM.slice(0, 7);
/** The window's first instant, in Dhaka. */
export const FEED_FROM_INSTANT = `${FEED_FROM}T00:00:00+06:00`;

/** A day inside the window: the later of the two. */
export const notBeforeWindow = (day: string) => (day < FEED_FROM ? FEED_FROM : day);
