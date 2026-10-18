/**
 * What people type when they look for a ministry: its English name, the
 * abbreviation everyone uses ("ICT", "LGRD"), and the one or two Bangla
 * words that stand for it in speech ("তথ্য", "ডাক", "রেল"). The cabinet
 * search on the site and in the app matches a query against these as well
 * as the ministry's own name, so "ict" finds the ICT minister and "তথ্য" the
 * information minister.
 *
 * Keyed by ministryKey() of the Cabinet Division's own text, so the list's
 * typing slips ("কর্মসংংস্থান", "বিজ্ঞানও প্রযুক্তি") reach the same entry as
 * the corrected spelling. A ministry not listed here is still found by its
 * own name; it just has no shortcuts.
 */
import { ministryKey } from '@/lib/posts/names';

const ALIASES: Record<string, string[]> = {
  'ডাক, টেলিযোগাযোগ ও তথ্যপ্রযুক্তি মন্ত্রণালয়': ['ICT', 'আইসিটি', 'Posts Telecommunications and Information Technology', 'Telecom', 'টেলিকম', 'ডাক', 'Post', 'Information Technology', 'IT', 'আইটি', 'প্রযুক্তি', 'Technology'],
  'তথ্য ও সম্প্রচার মন্ত্রণালয়': ['Information and Broadcasting', 'Information', 'তথ্য', 'Broadcasting', 'সম্প্রচার', 'তথ্যমন্ত্রী', 'Information Minister', 'Tottho', 'Tothyo', 'Totho'],
  'বিজ্ঞান ও প্রযুক্তি মন্ত্রণালয়': ['Science and Technology', 'Science', 'বিজ্ঞান', 'প্রযুক্তি', 'Technology'],
  'অর্থ মন্ত্রণালয়': ['Ortho', 'Finance', 'অর্থমন্ত্রী', 'Finance Minister', 'MoF', 'বাজেট', 'Budget'],
  'অর্থ ও পরিকল্পনা মন্ত্রণালয়': ['Finance and Planning', 'Finance', 'Planning', 'অর্থ', 'পরিকল্পনা'],
  'পরিকল্পনা মন্ত্রণালয়': ['Planning', 'পরিকল্পনা'],
  'বাণিজ্য মন্ত্রণালয়': ['Commerce', 'Trade', 'বাণিজ্যমন্ত্রী', 'Commerce Minister', 'ব্যবসা'],
  'শিল্প মন্ত্রণালয়': ['Industries', 'Industry', 'শিল্পমন্ত্রী'],
  'স্বরাষ্ট্র মন্ত্রণালয়': ['Sorastro', 'Swarashtra', 'Home', 'Home Affairs', 'Home Minister', 'স্বরাষ্ট্রমন্ত্রী', 'MoHA', 'পুলিশ', 'Police'],
  'পররাষ্ট্র মন্ত্রণালয়': ['Pororastro', 'Pararashtra', 'Foreign', 'Foreign Affairs', 'Foreign Minister', 'পররাষ্ট্রমন্ত্রী', 'MoFA', 'কূটনীতি'],
  'প্রতিরক্ষা মন্ত্রণালয়': ['Defence', 'Defense', 'প্রতিরক্ষামন্ত্রী', 'MoD', 'সেনাবাহিনী', 'Army'],
  'সশস্ত্র বাহিনী বিভাগ': ['Armed Forces Division', 'Armed Forces', 'AFD', 'সশস্ত্র বাহিনী'],
  'মন্ত্রিপরিষদ বিভাগ': ['Cabinet Division', 'Cabinet', 'মন্ত্রিপরিষদ'],
  'আইন, বিচার ও সংসদ বিষয়ক মন্ত্রণালয়': ['Ain', 'Law', 'Law Justice and Parliamentary Affairs', 'Law Minister', 'আইনমন্ত্রী', 'বিচার', 'Justice', 'সংসদ বিষয়ক'],
  'জনপ্রশাসন মন্ত্রণালয়': ['Public Administration', 'জনপ্রশাসনমন্ত্রী', 'প্রশাসন', 'Administration'],
  'স্থানীয় সরকার, পল্লী উন্নয়ন ও সমবায় মন্ত্রণালয়': ['LGRD', 'Local Government', 'Local Government Rural Development and Cooperatives', 'স্থানীয় সরকার', 'এলজিআরডি', 'পল্লী উন্নয়ন', 'সমবায়', 'Rural Development'],
  'শিক্ষা মন্ত্রণালয়': ['Shikkha', 'Education', 'Education Minister', 'শিক্ষামন্ত্রী', 'শিক্ষা'],
  'প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়': ['Primary and Mass Education', 'Primary Education', 'প্রাথমিক শিক্ষা', 'প্রাথমিক', 'গণশিক্ষা'],
  'স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়': ['Shastho', 'Swasthya', 'Health', 'Health and Family Welfare', 'Health Minister', 'স্বাস্থ্যমন্ত্রী', 'স্বাস্থ্য', 'পরিবার কল্যাণ', 'হাসপাতাল', 'Hospital'],
  'কৃষি মন্ত্রণালয়': ['Krishi', 'Agriculture', 'Agriculture Minister', 'কৃষিমন্ত্রী', 'কৃষি', 'চাষ', 'Farming'],
  'খাদ্য মন্ত্রণালয়': ['Khaddo', 'Food', 'Food Minister', 'খাদ্যমন্ত্রী', 'খাদ্য', 'চাল', 'Rice'],
  'মৎস্য ও প্রাণিসম্পদ মন্ত্রণালয়': ['Fisheries and Livestock', 'Fisheries', 'Livestock', 'মৎস্য', 'মাছ', 'প্রাণিসম্পদ', 'Fish'],
  'পানি সম্পদ মন্ত্রণালয়': ['Water Resources', 'Water', 'পানি', 'নদী', 'River'],
  'বিদ্যুৎ, জ্বালানি ও খনিজ সম্পদ মন্ত্রণালয়': ['Power Energy and Mineral Resources', 'Power', 'Energy', 'Electricity', 'বিদ্যুৎ', 'জ্বালানি', 'খনিজ', 'গ্যাস', 'Gas', 'Mineral'],
  'ভূমি মন্ত্রণালয়': ['Bhumi', 'Land', 'Land Minister', 'ভূমিমন্ত্রী', 'ভূমি', 'জমি'],
  'গৃহায়ন ও গণপূর্ত মন্ত্রণালয়': ['Housing and Public Works', 'Housing', 'Public Works', 'গৃহায়ন', 'গণপূর্ত', 'আবাসন'],
  'সড়ক পরিবহন ও সেতু মন্ত্রণালয়': ['Road Transport and Bridges', 'Road', 'Roads', 'Bridges', 'Transport', 'সড়ক', 'সেতু', 'পরিবহন', 'রাস্তা'],
  'সড়ক পরিবহন ও মহাসড়ক বিভাগ': ['Road Transport and Highways Division', 'Highways', 'Road', 'Transport', 'সড়ক', 'মহাসড়ক', 'পরিবহন'],
  'সেতু বিভাগ': ['Bridges Division', 'Bridge', 'Bridges', 'সেতু'],
  'রেলপথ মন্ত্রণালয়': ['Railways', 'Railway', 'Rail', 'Train', 'রেল', 'রেলপথ', 'ট্রেন', 'রেলমন্ত্রী'],
  'নৌপরিবহন মন্ত্রণালয়': ['Shipping', 'Shipping Minister', 'নৌ', 'নৌপরিবহন', 'জাহাজ', 'বন্দর', 'Port', 'নৌমন্ত্রী'],
  'বেসামরিক বিমান পরিবহন ও পর্যটন মন্ত্রণালয়': ['Civil Aviation and Tourism', 'Civil Aviation', 'Aviation', 'Tourism', 'বিমান', 'পর্যটন', 'Airline', 'Airport', 'বিমানবন্দর'],
  'পরিবেশ, বন ও জলবায়ু পরিবর্তন মন্ত্রণালয়': ['Environment Forest and Climate Change', 'Environment', 'Forest', 'Climate', 'পরিবেশ', 'বন', 'জলবায়ু'],
  'দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়': ['Disaster Management and Relief', 'Disaster', 'Relief', 'দুর্যোগ', 'ত্রাণ', 'বন্যা', 'Flood'],
  'শ্রম ও কর্মসংস্থান মন্ত্রণালয়': ['Labour and Employment', 'Labour', 'Labor', 'Employment', 'শ্রম', 'কর্মসংস্থান', 'শ্রমিক', 'Worker'],
  'প্রবাসী কল্যাণ ও বৈদেশিক কর্মসংস্থান মন্ত্রণালয়': ["Expatriates' Welfare and Overseas Employment", 'Expatriates', 'Expatriate Welfare', 'Overseas Employment', 'প্রবাসী', 'প্রবাসী কল্যাণ', 'বৈদেশিক কর্মসংস্থান', 'Migrant', 'রেমিট্যান্স', 'Remittance'],
  'বস্ত্র ও পাট মন্ত্রণালয়': ['Textiles and Jute', 'Textiles', 'Textile', 'Jute', 'বস্ত্র', 'পাট', 'গার্মেন্টস', 'Garments'],
  'মহিলা ও শিশু বিষয়ক মন্ত্রণালয়': ['Women and Children Affairs', 'Women', 'Children', 'মহিলা', 'নারী', 'শিশু'],
  'সমাজকল্যাণ মন্ত্রণালয়': ['Social Welfare', 'Welfare', 'সমাজকল্যাণ', 'সমাজ'],
  'ধর্ম বিষয়ক মন্ত্রণালয়': ['Dhormo', 'Religious Affairs', 'Religion', 'ধর্ম', 'ধর্মমন্ত্রী', 'হজ', 'Hajj'],
  'সংস্কৃতি বিষয়ক মন্ত্রণালয়': ['Cultural Affairs', 'Culture', 'সংস্কৃতি', 'সংস্কৃতিমন্ত্রী'],
  'মুক্তিযুদ্ধ বিষয়ক মন্ত্রণালয়': ['Liberation War Affairs', 'Liberation War', 'মুক্তিযুদ্ধ', 'মুক্তিযোদ্ধা', 'Freedom Fighter'],
  'পার্বত্য চট্টগ্রাম বিষয়ক মন্ত্রণালয়': ['Chittagong Hill Tracts Affairs', 'Chittagong Hill Tracts', 'CHT', 'Hill Tracts', 'পার্বত্য', 'পার্বত্য চট্টগ্রাম', 'পাহাড়'],
  'যুব ও ক্রীড়া মন্ত্রণালয়': ['Youth and Sports', 'Youth', 'Sports', 'যুব', 'ক্রীড়া', 'খেলা', 'খেলাধুলা', 'ক্রীড়ামন্ত্রী'],
  'রাজনৈতিক উপদেষ্টা': ['Political Adviser', 'Political', 'রাজনৈতিক'],
  'পলিসি ও স্ট্র্যাটেজি': ['Policy and Strategy', 'Policy', 'Strategy', 'পলিসি', 'নীতি'],
};

const BY_KEY = new Map<string, string[]>();
for (const [bn, list] of Object.entries(ALIASES)) BY_KEY.set(ministryKey(bn), list);

/** The shortcuts for a ministry as the list writes it; empty when there are none. */
export function ministryAliases(ministryBn: string | null | undefined): string[] {
  if (!ministryBn) return [];
  return BY_KEY.get(ministryKey(ministryBn)) ?? [];
}
