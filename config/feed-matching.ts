/**
 * What the feed matcher knows about language, kept out of the code so it can
 * be corrected without touching the scoring.
 */

/**
 * Surname spellings that are the same name. Applied to single tokens on both
 * sides, after the folding in lib/matching/nameMatch. Only surnames and
 * patronymics belong here: two given names that differ by a vowel are usually
 * two people (জাহেদ and জাহিদুর are not the same man).
 */
export const SPELLING_FOLD: Record<string, string> = {
  আহমেদ: 'আহমদ',
  আহমমেদ: 'আহমদ', // আহম্মেদ, after the hasanta is dropped
  আহমাদ: 'আহমদ',
  হোসাইন: 'হোসেন',
  হুসাইন: 'হোসেন',
  হুসেন: 'হোসেন',
  উদদিন: 'উদদিন', // উদ্দীন and উদ্দিন already fold together
  সিদদিকি: 'সিদদিকি',
  মিঞা: 'মিযা', // মিয়া, after the nukta is dropped
};

/**
 * Case endings a Bangla name takes in a sentence: মঈন খানের, সালাহউদ্দিন
 * আহমেদের, রহমানকে. Only the last word of a name carries one.
 */
export const CASE_SUFFIXES = ['', 'র', 'ের', 'এর', 'কে', 'ে', 'দের', 'রা', 'ও', 'ই', 'কেও', 'েরও', 'েই', 'য়ের', 'স'];

/**
 * Words that make a name in a headline somebody else: a cricketer, an actor, a
 * foreign politician, a police officer. A hit costs the match its name points,
 * which is what keeps a namesake off a member's page. Deliberately short: a
 * word here silences real stories too, so each one must be a job or a place a
 * sitting member cannot also be.
 */
export const NEGATIVE_CONTEXT = [
  'ক্রিকেটার', 'ক্রিকেট', 'ব্যাটসম্যান', 'বোলার', 'ফুটবলার', 'অধিনায়ক',
  'কবি', 'জাতীয় কবি', 'সাহিত্যিক', 'ঔপন্যাসিক', 'চিত্রশিল্পী',
  'অভিনেতা', 'অভিনেত্রী', 'নায়ক', 'নায়িকা', 'চিত্রনায়ক', 'গায়ক', 'গায়িকা', 'সংগীতশিল্পী', 'পরিচালক',
  'ভারতের প্রধানমন্ত্রী', 'পাকিস্তানের প্রধানমন্ত্রী', 'ভারতীয় অভিনেতা',
  'পুলিশ সুপার', 'ওসি', 'উপজেলা নির্বাহী', 'ইউএনও',
  'গ্রেপ্তারকৃত', 'ছাত্রদল নেতা', 'যুবদল নেতা', 'শ্রমিক নেতা',
];

/**
 * Descriptions that name a namesake when they stand right before the name:
 * "সাবেক মুখ্য সচিব আবুল কালাম আজাদ" is not the member. Unlike the words above,
 * these count only in that position, because the same words turn up elsewhere
 * in a member's own story ("ওয়ার্ড কাউন্সিলর প্রার্থীদের নিয়ে বললেন নাহিদ ইসলাম").
 * All seen on members' pages in 2026-09.
 */
export const NAMESAKE_TITLES = [
  'মৃত্যুদণ্ডপ্রাপ্ত', 'ফাঁসির দণ্ডপ্রাপ্ত', 'সাবেক মুখ্য সচিব', 'মুখ্য সচিব', 'পিআইও',
  'সাবেক কাউন্সিলর', 'কাউন্সিলর', 'ভাষাসৈনিক', 'সাংবাদিক', 'শিল্পী', 'উপাচার্য',
  // Police and court officers, who are named in crime reports the same way.
  'উপপরিদর্শক', 'এসআই', 'এ এস আই', 'এএসআই', 'সহকারী উপপরিদর্শক', 'পরিদর্শক', 'তদন্ত কর্মকর্তা',
  'কনস্টেবল', 'সাব ইন্সপেক্টর', 'ইন্সপেক্টর', 'অতিরিক্ত পুলিশ সুপার', 'পুলিশ পরিদর্শক', 'বিচারক',
];

/**
 * Pictures an outlet gives to every story that has none of its own: the same
 * file, a different name each time. dailyinqilab's "inq-graphics" front page
 * filled three cards on the home page with one image on 18 September 2026.
 */
export const GENERIC_THUMBNAILS = [/\/inq-graphics-\d+\.(jpg|jpeg|png|webp)$/i];

/** Is this a picture of the story, or the outlet's stand-in for one? */
export const isGenericThumbnail = (url: string | null | undefined) =>
  !!url && GENERIC_THUMBNAILS.some((re) => re.test(url));

/**
 * Office titles the press uses, mapped to the post title the posts sync
 * stores. A headline that says "পররাষ্ট্রমন্ত্রী" is about whoever holds that
 * ministry; the matcher only awards the points to the member who holds it.
 */
export const POST_WORDS: { word: string; matches: (post: string, ministry: string | null) => boolean }[] = [
  { word: 'প্রধানমন্ত্রী', matches: (p) => p === 'প্রধানমন্ত্রী' },
  { word: 'স্পিকার', matches: (p) => p === 'স্পিকার' },
  { word: 'ডেপুটি স্পিকার', matches: (p) => p === 'ডেপুটি স্পিকার' },
  { word: 'বিরোধীদলীয় নেতা', matches: (p) => p === 'বিরোধীদলীয় নেতা' },
  { word: 'সংসদ নেতা', matches: (p) => p === 'সংসদ নেতা' },
  { word: 'চিফ হুইপ', matches: (p) => p === 'চিফ হুইপ' },
  { word: 'হুইপ', matches: (p) => p === 'হুইপ' },
];

/**
 * The news channels whose uploads are worth reading every hour.
 *
 * Handles rather than ids, because a handle is what a person can check; the
 * collector resolves each one to its uploads playlist once and remembers it.
 * Reading a channel's latest uploads costs one quota unit, against a hundred
 * for a name search, which is why this list is where most of the video in the
 * feed comes from: every upload is matched against all 348 members, instead of
 * four members being searched for by name.
 */
export const TRUSTED_CHANNELS: { handle: string; name: string }[] = [
  // Every handle below was opened on youtube.com and the channel's own name
  // checked, after five guesses turned out to be 404s and one (@Channel24) was
  // a private person in another country. একাত্তর came from the outlet's own
  // site; চ্যানেল ২৪ is left out because neither its site nor any spelling
  // tried leads to a channel whose uploads can be read.
  { handle: '@somoytvnews', name: 'সময় টিভি' },
  { handle: '@JamunaTVbd', name: 'যমুনা টিভি' },
  { handle: '@dbcnewstv', name: 'ডিবিসি নিউজ' },
  { handle: '@IndependentTelevision', name: 'ইনডিপেনডেন্ট টিভি' },
  { handle: '@EkattorTelevision', name: 'একাত্তর টিভি' },
  { handle: '@NTVbd', name: 'এনটিভি' },
  { handle: '@rtvnews', name: 'আরটিভি নিউজ' },
  { handle: '@news24bdtv', name: 'নিউজ২৪' },
  { handle: '@ATNNewsOfficial', name: 'এটিএন নিউজ' },
  { handle: '@ETVNewsbd', name: 'একুশে টিভি' },
  { handle: '@BanglavisionNEWS', name: 'বাংলাভিশন' },
  { handle: '@MaasrangaTelevision', name: 'মাছরাঙা টেলিভিশন' },
  { handle: '@ChanneliNews', name: 'চ্যানেল আই নিউজ' },
  { handle: '@EkhonTV', name: 'এখন টিভি' },
  { handle: '@BBCBangla', name: 'বিবিসি বাংলা' },
  { handle: '@DWBengali', name: 'ডয়চে ভেলে বাংলা' },
  { handle: '@ProthomAlo', name: 'প্রথম আলো' },
  { handle: '@thedailystarnews', name: 'দ্য ডেইলি স্টার' },
  { handle: '@jagonews24', name: 'জাগো নিউজ' },
];
