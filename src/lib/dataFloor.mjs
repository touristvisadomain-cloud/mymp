/**
 * The floor under a build (scripts/sync.mjs). The admin database has to hold at
 * least half of what the committed snapshot in data/ was built with: the editors'
 * corrections, the published vote counts and the published news.
 *
 * Without it, a build against an empty or wrong database publishes the site with
 * every correction, vote count and published story gone, and reports success.
 * That happened on the move to the VPS in October 2026, when the site was built
 * against a fresh database that nothing had been copied into.
 *
 * ALLOW_DATA_DROP=1 lets one build through on purpose.
 */

/** Below these the committed snapshot is too small to judge by. */
export const FLOORS = { overrides: 100, results: 50, news: 50 };

/**
 * Null when `now` is at least half of `before`, or `before` is under `minimum`;
 * otherwise a sentence saying what fell.
 * @param {string} label
 * @param {number} now
 * @param {number} before
 * @param {number} minimum
 * @returns {string | null}
 */
export function dataDrop(label, now, before, minimum) {
  if (before < minimum || now * 2 >= before) return null;
  return `${label}: the database gave ${now}, the committed snapshot has ${before}`;
}

/**
 * The error that stops the build, with what to do about it.
 * @param {string} reason
 */
export function dataDropError(reason) {
  // `fatal` is read by sync.mjs's catch, so --soft cannot swallow this one.
  return Object.assign(
    new Error(
      `refusing to publish, ${reason}. The admin database looks empty or is not the right one; ` +
        'restore its data first (docs/vps-deployment.md). ALLOW_DATA_DROP=1 publishes anyway.',
    ),
    { fatal: true },
  );
}
