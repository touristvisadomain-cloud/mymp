/**
 * A parliamentary committee's link-preview image, 1200x630: the chair's
 * photo, the committee's type, its name (wrapped, up to three lines), its
 * chair and how many members it has, all in the centre square that WhatsApp
 * keeps (src/lib/og/frame.tsx).
 *
 * A committee whose list still carries the previous parliament's members
 * shows neither chair nor count, as its page does not; it says the list is
 * awaiting an update instead.
 *
 * Bangla is shaped by HarfBuzz (src/lib/og/banglaText.ts). Drawn in either
 * language: the English card (/api/og/committee/<slug>/en) is for the
 * English page's shares.
 */
import { getCommittee, getMemberById } from '@/lib/data';
import { committeeTitle, typeName } from '@/lib/committeeDuties';
import { bnTextImage } from '@/lib/og/banglaText';
import { card, Disc, Mark, Photo, photoData, Pill, Text, TEXT_WIDTH } from '@/lib/og/frame';
import { personName } from '@/i18n/names';
import { makeT, plural, type Lang } from '@/i18n/core';

const PHOTO = 150;

/** The card for a committee, in the given language; 404 for an unknown committee. */
export async function committeeCard(slug: string, lang: Lang): Promise<Response> {
  const en = lang === 'en';
  const t = makeT(lang);
  const c = getCommittee(slug);
  if (!c) return new Response('Not found', { status: 404 });

  const chairId = c.rosterCurrent ? c.members.find((x) => x.role === 'Chairman')?.memberId : undefined;
  const chair = chairId ? getMemberById(chairId) : undefined;
  const count = c.rosterCurrent ? c.members.length : 0;
  const type = typeName(c.type, lang);
  const name = (en ? committeeTitle(c, 'en') : c.nameBn ?? c.nameEn) || t('কমিটি', 'Committee');
  const white = { color: '#ffffff' };

  const [kicker, title, chairText, members, photo] = await Promise.all([
    type ? bnTextImage(type, { ...white, weight: 'regular', maxSize: 23, minSize: 18, maxWidth: TEXT_WIDTH - 48, maxLines: 1, opacity: 0.92 }) : null,
    bnTextImage(name, { ...white, weight: 'bold', maxSize: en ? 50 : 46, minSize: 30, maxWidth: TEXT_WIDTH, maxLines: 3, leading: 1.2, align: 'center' }),
    chair
      ? bnTextImage(`${t('সভাপতি', 'Chair')}${en ? ': ' : ' '}${en ? personName(chair, 'en') : chair.nameBn ?? chair.nameEn ?? ''}`, { ...white, weight: 'regular', maxSize: 28, minSize: 20, maxWidth: TEXT_WIDTH, maxLines: 1, opacity: 0.95 })
      : null,
    bnTextImage(
      count
        ? en ? `${count} ${plural(count, 'member', 'members')}` : `সদস্য ${t.n(count)} জন`
        : t('সদস্য তালিকা হালনাগাদের অপেক্ষায়', 'Member list awaiting update'),
      { ...white, weight: 'bold', maxSize: 27, minSize: 20, maxWidth: TEXT_WIDTH - 48, maxLines: 1 },
    ),
    photoData(chair?.photoUrl),
  ]);

  return card(
    <>
      {chair ? (
        <Photo src={photo} size={PHOTO} />
      ) : (
        <Disc size={PHOTO + 10}>
          <Mark size={72} inverse />
        </Disc>
      )}
      {kicker && <Pill t={kicker} />}
      <Text t={title} />
      {chairText && <Text t={chairText} />}
      <Pill t={members} strong />
    </>,
    { gap: 15 },
  );
}
