/**
 * The YouTube channels a video may come from: the official channels of the
 * outlets in config/news-sources.ts, and nothing else (owner, 2026-10-15:
 * "the eighty and the new fifty, no source outside them").
 *
 * A channel counts as an outlet's own only with evidence, gathered on
 * 2026-10-15 and recorded in `how`:
 *   site     the outlet's own website links to the channel
 *   channel  the channel's own page links to the outlet's website
 *   both     both of the above
 *   checked  opened on youtube.com by hand and its name checked (the
 *            original trusted list in feed-matching.ts)
 * A member search on YouTube returns any channel that says the name; every
 * result from a channel not listed here is dropped. To add one, find the
 * same evidence and add a row.
 */
export interface OfficialChannel {
  /** The channel id, UC…: what the YouTube API reports on every video. */
  id: string;
  handle: string;
  /** The key of the outlet in config/news-sources.ts. */
  source: string;
  how: 'site' | 'channel' | 'both' | 'checked';
}

export const OFFICIAL_CHANNELS: OfficialChannel[] = [
  { id: 'UC0GfqDQyXKHM-bkyHkAV-Ig', handle: '@AmaderShomoyOfficial', source: 'amadershomoy', how: 'both' },
  { id: 'UCVBUCoStRou7DZtlTxmhAmQ', handle: '@dailyamardeshnews', source: 'amardesh', how: 'both' },
  { id: 'UC4RlKosJk8wrdBI0BVqisrw', handle: '@amarsangbad24', source: 'amarsangbad', how: 'both' },
  { id: 'UCbgcYEdMsuypG2NJ-znBp3w', handle: '@ATNBanglanews', source: 'atnbangla', how: 'both' },
  { id: 'UCt8llfhkf9LRzjTEnbG2qnQ', handle: '@ATNNews24', source: 'atnnews', how: 'channel' },
  { id: 'UCKlhfq1ILoAFav7iw5iCnfA', handle: '@ATNNewsLive', source: 'atnnews', how: 'channel' },
  { id: 'UCsmpE0uo18-061AmP1Pz2Vw', handle: '@ATNNewsOfficial', source: 'atnnews', how: 'checked' },
  { id: 'UCzkXEyV_CwVXgc28gIPFoGw', handle: '@bkdigital247', source: 'bangladesherkhabor', how: 'both' },
  { id: 'UCzfkD4dNxVlIhUW3xaM4uxw', handle: '@Banglanews24-Youtube', source: 'banglanews24', how: 'channel' },
  { id: 'UCnxq-SRl0fYCFB20v899A0g', handle: '@BanglaStreamYT', source: 'banglastream', how: 'both' },
  { id: 'UCccHjrZ3Db_471nivPDiICQ', handle: '@Dhaka_Stream', source: 'banglastream', how: 'both' },
  { id: 'UCl5m--M5b_AYWvMBivP0wfA', handle: '@banglatelegraph2012', source: 'banglatelegraph', how: 'site' },
  { id: 'UCA4y9g_GRdNrZLH_u5LLSdw', handle: '@BanglaVisionNEWS', source: 'banglavision', how: 'channel' },
  { id: 'UCduBwdOk5CFTzmyW-JZxhDg', handle: '@BanijjoProtidinbd', source: 'banijjoprotidin', how: 'site' },
  { id: 'UChPD2BQ2dJ-w00klQQkc-Qg', handle: '@BBCBangla', source: 'bbcbangla', how: 'both' },
  { id: 'UCZpB6g1nnXcRsj3c9R2t_NA', handle: '@bd24liveofficial', source: 'bd24live', how: 'both' },
  { id: 'UCjFMRqrsABGBh-6eFUlMuAA', handle: '@bdnews24', source: 'bdnews24', how: 'channel' },
  { id: 'UCEwqW2yZ5XP-g0AVIYBAKnQ', handle: '@DailyBonikbartanews', source: 'bonikbarta', how: 'both' },
  { id: 'UCsP7n-3TsVuhEk8-boNzv0w', handle: '@BSSAudioVisual', source: 'bss', how: 'site' },
  { id: 'UCeU0BTbx7aDFfGSEF-2sZ5Q', handle: '@channel24ctg', source: 'channel24', how: 'channel' },
  { id: 'UCHLqIOMPk20w-6cFgkA90jw', handle: '@channel24digital', source: 'channel24', how: 'channel' },
  { id: 'UCO5DuUbUSJNS6A7tgfOLpaA', handle: '@Channeli_Entertainment', source: 'channeli', how: 'both' },
  { id: 'UC8NcXMG3A3f2aFQyGTpSNww', handle: '@ChanneliNews', source: 'channeli', how: 'both' },
  { id: 'UCAz6rveBalVnE6qTmfQnvyQ', handle: '@channelionline', source: 'channeli', how: 'both' },
  { id: 'UCLuPUjbBSIYmltR5D8Srq7A', handle: '@ChanneliShows', source: 'channeli', how: 'channel' },
  { id: 'UCdToTtQYK7AYsarULHfU1EQ', handle: '@ChannelSNews24', source: 'channels', how: 'both' },
  { id: 'UC6_EJUMSqGzgib9cOldIBjQ', handle: '@ComillarKagojTV', source: 'comillarkagoj', how: 'both' },
  { id: 'UCdBZmfN27TNQjEHA7TkGnDw', handle: '@DBanglaPost', source: 'dailybanglapost', how: 'both' },
  { id: 'UCKSJ5rTXq-pYgAmAOhVS_zQ', handle: '@TheDailyStarNews', source: 'dailystar', how: 'channel' },
  { id: 'UCQrZEJdo-au9XzRh6DwTjdg', handle: '@DainikAzadiofficial', source: 'dainikazadi', how: 'both' },
  { id: 'UCUvXoiDEKI8VZJrr58g4VAw', handle: '@dbcnewstv', source: 'dbcnews', how: 'channel' },
  { id: 'UCMbO-c2g92KPgOzYKDsTbug', handle: '@DeshRupantor', source: 'deshrupantor', how: 'both' },
  { id: 'UCmCCTsDl-eCKw91shC7ZmMw', handle: '@deshtvnews', source: 'deshtv', how: 'channel' },
  { id: 'UCeB7K4IRCC_Rb1w5HswUPnQ', handle: '@DhakaProkash', source: 'dhakaprokash', how: 'both' },
  { id: 'UCnFUVqchaFgKV3RseMfLVNg', handle: '@DhakaTimesDigital', source: 'dhakatimes', how: 'both' },
  { id: 'UCHaRt3_3HSu8ru7ll1cR9cQ', handle: '@Dinajpurtv', source: 'dinajpurtv', how: 'both' },
  { id: 'UCqvwK4CRCqIT-hC4vfYgVQA', handle: '@DurbinNewsOfficial', source: 'durbinnews', how: 'site' },
  { id: 'UCIIkOzwZIdLfHa4Q13dQrkw', handle: '@DWBengali', source: 'dwbangla', how: 'checked' },
  { id: 'UCtqvtAVmad5zywaziN6CbfA', handle: '@EkattorTelevision', source: 'ekattor', how: 'site' },
  { id: 'UCWVqdPTigfQ-cSNwG7O9MeA', handle: '@ekhontv', source: 'ekhontv', how: 'channel' },
  { id: 'UCBQxpxkI2qLRAFR_6PNdwIA', handle: '@EkusheyETV', source: 'ekushey', how: 'both' },
  { id: 'UCBabS5ztlMQhZ8A95at-sIw', handle: '@EkusheyTelevision', source: 'ekushey', how: 'channel' },
  { id: 'UC7m9bkT7Sc-Ud3HW7frxjYQ', handle: '@ETVNewsbd', source: 'ekushey', how: 'checked' },
  { id: 'UCO3IevCf81h4R4lKJpZ4sfA', handle: '@IndependentSports', source: 'itv', how: 'both' },
  { id: 'UCATUkaOHwO9EP_W87zCiPbA', handle: '@IndependentTelevision', source: 'itv', how: 'both' },
  { id: 'UCdPlmWCtoAs_4QsgY3OsK2w', handle: '@IndependentWorld', source: 'itv', how: 'both' },
  { id: 'UCWJkfdG6J2HUxOHrORuHZ2g', handle: '@jagonews24', source: 'jagonews24', how: 'channel' },
  { id: 'UCN6sm8iHiPd0cnoUardDAnw', handle: '@JamunaTVbd', source: 'jamuna', how: 'channel' },
  { id: 'UCBl9dksVqTm5fe3CBiUdllg', handle: '@dailyjanakanthabd', source: 'janakantha', how: 'site' },
  { id: 'UC5W4-m4xB_yy0fBkWrbFFbA', handle: '@dailyjanobaninews', source: 'janobani', how: 'both' },
  { id: 'UCKbhCXpZwAmFN4UHeT8HTjA', handle: '@DailyJugantorbd', source: 'jugantor', how: 'channel' },
  { id: 'UCRt2klyaxgx89vPF8cFMfnQ', handle: '@kalbelanews24', source: 'kalbela', how: 'channel' },
  { id: 'UCIS8vxDuiRtCNYn92NP94Lw', handle: '@DailyKaratoabd', source: 'karatoa', how: 'both' },
  { id: 'UCGSWnwv4-V3sD6x9Ezd3yNw', handle: '@MaasrangaDrama', source: 'maasranga', how: 'both' },
  { id: 'UCHR-p802PibDYG1btNJcOew', handle: '@MaasrangaNewsbd', source: 'maasranga', how: 'both' },
  { id: 'UC7lUFHcujxyC76r2LkmSOZA', handle: '@MaasrangaProgram', source: 'maasranga', how: 'both' },
  { id: 'UCeRYeMYCASmS9GVhom0C7Lw', handle: '@MaasrangaSports', source: 'maasranga', how: 'both' },
  { id: 'UCmvYitalFiF_oaJosda0e6A', handle: '@MaasrangaTelevision', source: 'maasranga', how: 'checked' },
  { id: 'UCJGnNvYgPpUhd7ImU9diBSQ', handle: '@MaasrangaTVOfficial', source: 'maasranga', how: 'both' },
  { id: 'UCVM5VKCfpq3odJroAZMCv2A', handle: '@ManobkanthaOnline', source: 'manobkantha', how: 'both' },
  { id: 'UC9b_MnX3HN9ABYT89QqYMTw', handle: '@MohonaTvLtd', source: 'mohona', how: 'both' },
  { id: 'UC9zgYOQB6zkleAQjW53DLeQ', handle: '@mytvbangla', source: 'mytv', how: 'channel' },
  { id: 'UCgbaV2akib7J5wpO-Sq4XBg', handle: '@ManabZaminDigital', source: 'mzamin', how: 'both' },
  { id: 'UCig6MgICx3g8p3IHZM45oEA', handle: '@NagorikTVOfficial', source: 'nagorik', how: 'both' },
  { id: 'UCcXngksKUkE4sLl5Jgg9w5w', handle: '@NewAgeBDdigital', source: 'newage', how: 'both' },
  { id: 'UCOatuzsY8lD3hP_-_9muiOw', handle: '@news24bdtv', source: 'news24bd', how: 'checked' },
  { id: 'UCPREnbhKQP-hsVfsfKP-mCw', handle: '@NEWS24TV', source: 'news24bd', how: 'channel' },
  { id: 'UCHKvg7FqyEqmOkYx0y4KtlA', handle: '@NEWS24TVBD', source: 'news24bd', how: 'channel' },
  { id: 'UC7ncoxY6bbd5UfPo6FdZNbA', handle: '@NTVbd', source: 'ntv', how: 'checked' },
  { id: 'UCUDQdVsKssximyFwg4IxnOQ', handle: '@NTVlatestnews', source: 'ntv', how: 'channel' },
  { id: 'UCaMUXAJ2VmSRtkg5f6nfgUw', handle: '@PressNarayanganj', source: 'pressnarayanganj', how: 'both' },
  { id: 'UCeG7m5-AJ4I0H4EIleIty4Q', handle: '@ProthomAlo', source: 'prothomalo', how: 'channel' },
  { id: 'UCsZt_X69CMKvnY2WHwoPBVg', handle: '@purbanchalmedia4417', source: 'purbanchal', how: 'both' },
  { id: 'UC2P5Fd5g41Gtdqf0Uzh8Qaw', handle: '@RtvNews', source: 'rtv', how: 'channel' },
  { id: 'UCyWOpb4JcfwP833oieTQpgA', handle: '@newsrupalibangladesh', source: 'rupalibangladesh', how: 'site' },
  { id: 'UCnetEdV8EwzGn36f3pq50ZA', handle: '@SamakalNews', source: 'samakal', how: 'both' },
  { id: 'UCumU8qRWs3JkkqMvthWExgA', handle: '@dailysangbadsarabela', source: 'sangbadsarabela', how: 'both' },
  { id: 'UCQ3v4nNWdPOnFe691ZCon9A', handle: '@ShomoyerAlo', source: 'shomoyeralo', how: 'channel' },
  { id: 'UCyQbsIEL-oJVH3QlAwIWu-g', handle: '@somoyerkonthosor2408', source: 'somoyerkonthosor', how: 'site' },
  { id: 'UCxHoBXkY88Tb8z1Ssj6CWsQ', handle: '@somoynews360', source: 'somoynews', how: 'channel' },
  { id: 'UC7STXq0KhgTAK6APs6v-PwA', handle: '@somoytvnews', source: 'somoynews', how: 'checked' },
  { id: 'UCToBzIYWN65UAVtR2TTatXA', handle: '@thedailysuprobhat', source: 'suprobhat', how: 'both' },
  { id: 'UCUNEzmQ3zcifrhn0HwCgjYg', handle: '@TheBusinessStandard', source: 'tbs', how: 'channel' },
  { id: 'UCO2Ds5LXqzQSH6HMnJFWYBA', handle: '@UNBUnitedNewsofBangladesh', source: 'unb', how: 'channel' },
];

export const OFFICIAL_CHANNEL_IDS = new Set(OFFICIAL_CHANNELS.map((c) => c.id));
