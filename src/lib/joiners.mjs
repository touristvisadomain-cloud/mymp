/**
 * Zero-width joiners in Bangla text.
 *
 * The parliament's data, and some outlets' headlines, carry joiners left by a
 * Bijoy-to-Unicode conversion: "ব‌্যবসা" draws as ব, a bare hasanta and য
 * instead of ব্যবসা. A joiner right after a hasanta is deliberate ("মাহ্‌দী",
 * an explicit hasanta), and so is one between র and a hasanta ("র‌্যাব",
 * RAB, a র with য-ফলা rather than a reph). Every other one is dropped.
 *
 * Plain JavaScript so that scripts/sync.mjs can use it as well as the site.
 *
 * @param {string} text
 * @returns {string}
 */
export function fixJoiners(text) {
  if (!text || !/[‌‍]/.test(text)) return text;
  return text.replace(/[‌‍]+/g, (m, at, all) => {
    const prev = all[at - 1];
    const next = all[at + m.length];
    if (prev === '্') return m;
    if (prev === 'র' && next === '্') return m;
    return '';
  });
}
