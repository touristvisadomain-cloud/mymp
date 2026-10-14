/**
 * সংসদ schema: the data engine behind mymp.bd.
 *
 * Every fact that reaches a reader carries its provenance: a source URL, a
 * stored copy where allowed, and for anything editorial a verifier. Rows the
 * public may see are gated by status columns; the RLS policies in sql/rls.sql
 * expose only those. Workers and admins write through the service role.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const sangsadSchema = pgSchema('sangsad');

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/* ---------------- reference ---------------- */

export const parliaments = sangsadSchema.table('parliaments', {
  id: serial('id').primaryKey(),
  number: integer('number').notNull().unique(),
  electionDate: date('election_date'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  /** parliament.gov.bd's own id for the election set this parliament came from. */
  sourceElectionId: integer('source_election_id'),
});

/**
 * Keyed on the source's party id, not the abbreviation: the source lists two
 * different parties as "JP" and two as "BJP".
 */
export const parties = sangsadSchema.table('parties', {
  id: serial('id').primaryKey(),
  nameBn: text('name_bn').notNull(),
  nameEn: text('name_en').notNull(),
  shortName: text('short_name').notNull(),
  /** Hex colour used identically for every party chip; no party gets a special treatment. */
  color: text('color'),
  sourceId: integer('source_id').unique(),
});

export const divisions = sangsadSchema.table('divisions', {
  id: serial('id').primaryKey(),
  nameBn: text('name_bn').notNull(),
  nameEn: text('name_en').notNull(),
  slug: text('slug').notNull().unique(),
  sourceId: integer('source_id').unique(),
});

export const districts = sangsadSchema.table(
  'districts',
  {
    id: serial('id').primaryKey(),
    divisionId: integer('division_id')
      .notNull()
      .references(() => divisions.id),
    nameBn: text('name_bn').notNull(),
    nameEn: text('name_en').notNull(),
    slug: text('slug').notNull().unique(),
    sourceId: integer('source_id').unique(),
  },
  (t) => [index('districts_division_idx').on(t.divisionId)],
);

export const constituencies = sangsadSchema.table(
  'constituencies',
  {
    id: serial('id').primaryKey(),
    parliamentId: integer('parliament_id')
      .notNull()
      .references(() => parliaments.id),
    number: integer('number').notNull(),
    nameBn: text('name_bn').notNull(),
    nameEn: text('name_en').notNull(),
    slug: text('slug').notNull(),
    /** Null for the fifty reserved women's seats, which belong to no district. */
    districtId: integer('district_id').references(() => districts.id),
    isReservedWomen: boolean('is_reserved_women').notNull().default(false),
    boundaryBn: text('boundary_bn'),
    sourceId: integer('source_id'),
    sourceUrl: text('source_url'),
  },
  (t) => [
    unique('constituencies_parliament_number').on(t.parliamentId, t.number),
    unique('constituencies_parliament_slug').on(t.parliamentId, t.slug),
    index('constituencies_district_idx').on(t.districtId),
  ],
);

/* ---------------- members ---------------- */

export const genderEnum = sangsadSchema.enum('gender', ['male', 'female', 'other', 'unknown']);

/**
 * People. The columns after `gender` are what parliament.gov.bd publishes about
 * a member and are shown labelled as such; nothing is written here by hand.
 * Mobile numbers exist in the source and are deliberately never stored.
 */
export const members = sangsadSchema.table(
  'members',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    nameBn: text('name_bn').notNull(),
    nameEn: text('name_en'),
    /** Our stored copy (Supabase Storage). Null means the neutral placeholder is shown. */
    photoUrl: text('photo_url'),
    /** Where the photo came from: only parliament.gov.bd is acceptable. */
    photoSourceUrl: text('photo_source_url'),
    photoCheckedAt: timestamp('photo_checked_at', { withTimezone: true }),
    dateOfBirth: date('date_of_birth'),
    gender: genderEnum('gender').notNull().default('unknown'),
    professionBn: text('profession_bn'),
    fatherNameBn: text('father_name_bn'),
    motherNameBn: text('mother_name_bn'),
    presentAddressBn: text('present_address_bn'),
    /** The official parliament mailbox (seat@parliament.gov.bd), never a personal address. */
    officialEmail: text('official_email'),
    isFreedomFighter: boolean('is_freedom_fighter').notNull().default(false),
    /** The source carries a written biography for the presiding officers only. */
    officialSummaryBn: text('official_summary_bn'),
    officialBioBn: text('official_bio_bn'),
    /** parliament.gov.bd externalId, e.g. 013019001. Stable within a parliament. */
    sourceExternalId: text('source_external_id').unique(),
    /** parliament.gov.bd person id (empId); reliable from the 11th parliament on. */
    sourcePersonId: integer('source_person_id'),
    sourceUrl: text('source_url'),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('members_name_bn_idx').on(t.nameBn), index('members_person_idx').on(t.sourcePersonId)],
);

export const memberTerms = sangsadSchema.table(
  'member_terms',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    parliamentId: integer('parliament_id')
      .notNull()
      .references(() => parliaments.id),
    constituencyId: integer('constituency_id').references(() => constituencies.id),
    /** The seat as the source names it, kept for earlier parliaments whose seat rows may be absent. */
    seatLabelBn: text('seat_label_bn'),
    seatLabelEn: text('seat_label_en'),
    partyId: integer('party_id').references(() => parties.id),
    /** MP, Speaker, Deputy Speaker, Leader of the House, Leader of the Opposition, Chief Whip, Whip, Prime Minister… */
    role: text('role').notNull().default('MP'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    /** How an earlier term was tied to this person: person-id, name+dob, name+seat. Null for the current parliament. */
    matchedBy: text('matched_by'),
    sourceUrl: text('source_url'),
  },
  (t) => [
    unique('member_terms_member_parliament_role').on(t.memberId, t.parliamentId, t.role),
    index('member_terms_parliament_idx').on(t.parliamentId),
    index('member_terms_constituency_idx').on(t.constituencyId),
  ],
);

export const aliasLanguageEnum = sangsadSchema.enum('alias_language', ['bn', 'en']);

export const memberAliases = sangsadSchema.table(
  'member_aliases',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    language: aliasLanguageEnum('language').notNull(),
    /** 'source' for aliases derived from parliament.gov.bd, otherwise the admin who added it. */
    addedBy: text('added_by'),
    createdAt: createdAt(),
  },
  (t) => [unique('member_aliases_member_alias').on(t.memberId, t.alias), index('member_aliases_alias_idx').on(t.alias)],
);

/* ---------------- elections ---------------- */

export const verifyStatusEnum = sangsadSchema.enum('verify_status', ['pending', 'verified', 'rejected']);

export const electionResults = sangsadSchema.table(
  'election_results',
  {
    id: serial('id').primaryKey(),
    parliamentId: integer('parliament_id')
      .notNull()
      .references(() => parliaments.id),
    constituencyId: integer('constituency_id')
      .notNull()
      .references(() => constituencies.id),
    candidateName: text('candidate_name').notNull(),
    partyId: integer('party_id').references(() => parties.id),
    /** Free text when the party is not in `parties` (an independent, a defunct party). */
    partyLabel: text('party_label'),
    votes: integer('votes'),
    isWinner: boolean('is_winner').notNull().default(false),
    /** Percentage of registered voters who voted, for the constituency as a whole. */
    turnout: numeric('turnout', { precision: 5, scale: 2 }),
    sourceUrl: text('source_url').notNull(),
    storedPdfPath: text('stored_pdf_path'),
    status: verifyStatusEnum('status').notNull().default('pending'),
    verifiedBy: uuid('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('election_results_constituency_idx').on(t.parliamentId, t.constituencyId)],
);

/* ---------------- affidavits ---------------- */

export const extractionMethodEnum = sangsadSchema.enum('extraction_method', ['text', 'ocr', 'manual']);

export const affidavits = sangsadSchema.table(
  'affidavits',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    parliamentId: integer('parliament_id')
      .notNull()
      .references(() => parliaments.id),
    /** Where the PDF was published (ECS). Required so every figure links back to its proof. */
    pdfUrl: text('pdf_url').notNull(),
    storedPdfPath: text('stored_pdf_path'),
    education: text('education'),
    profession: text('profession'),
    annualIncome: text('annual_income'),
    totalAssets: text('total_assets'),
    liabilities: text('liabilities'),
    /** Raw extractor output, kept for the reviewer; never rendered publicly. */
    rawText: text('raw_text'),
    extractionMethod: extractionMethodEnum('extraction_method').notNull().default('text'),
    status: verifyStatusEnum('status').notNull().default('pending'),
    verifiedBy: uuid('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('affidavits_member_parliament').on(t.memberId, t.parliamentId)],
);

export const affidavitCases = sangsadSchema.table('affidavit_cases', {
  id: serial('id').primaryKey(),
  affidavitId: integer('affidavit_id')
    .notNull()
    .references(() => affidavits.id, { onDelete: 'cascade' }),
  caseDescription: text('case_description').notNull(),
  /** Exactly as declared: pending, disposed, acquitted… Never our own judgement. */
  status: text('status'),
  sourcePage: integer('source_page'),
});

/* ---------------- committees ---------------- */

export const committees = sangsadSchema.table(
  'committees',
  {
    id: serial('id').primaryKey(),
    parliamentId: integer('parliament_id')
      .notNull()
      .references(() => parliaments.id),
    nameBn: text('name_bn').notNull(),
    nameEn: text('name_en'),
    slug: text('slug').notNull(),
    type: text('type'),
    /** False while the source still lists the previous parliament's members. */
    rosterCurrent: boolean('roster_current').notNull().default(false),
    /** How many people the source lists, current or not; shown so a hidden roster is not mistaken for an empty one. */
    sourceMemberCount: integer('source_member_count').notNull().default(0),
    startDate: date('start_date'),
    sourceId: integer('source_id').unique(),
    sourceUrl: text('source_url'),
  },
  (t) => [unique('committees_parliament_slug').on(t.parliamentId, t.slug)],
);

export const memberCommittees = sangsadSchema.table(
  'member_committees',
  {
    id: serial('id').primaryKey(),
    committeeId: integer('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('Member'),
  },
  (t) => [unique('member_committees_pair').on(t.committeeId, t.memberId)],
);

/* ---------------- what the House is doing ---------------- */

/** A session of a parliament as the secretariat records it. */
export const parliamentSessions = sangsadSchema.table('parliament_sessions', {
  id: serial('id').primaryKey(),
  parliamentId: integer('parliament_id')
    .notNull()
    .references(() => parliaments.id),
  sourceId: integer('source_id').notNull().unique(),
  titleBn: text('title_bn'),
  titleEn: text('title_en'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  sourceUrl: text('source_url'),
});

/** One sitting day, with its order-of-the-day PDF on the parliament's own server. */
export const sittings = sangsadSchema.table(
  'sittings',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => parliamentSessions.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id').notNull().unique(),
    titleBn: text('title_bn'),
    date: date('date'),
    pdfUrl: text('pdf_url'),
    /** The circular (পরিপত্র) this sitting was announced under, when the source says. */
    circularNo: integer('circular_no'),
  },
  (t) => [index('sittings_date_idx').on(t.date)],
);

/**
 * Secretariat notices worth showing: government orders about individual
 * members, committee meeting notices, and general notifications. Staff
 * office orders, tenders and downloads are filtered out by the worker.
 */
export const notices = sangsadSchema.table(
  'notices',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id').notNull().unique(),
    type: text('type').notNull(),
    category: text('category'),
    date: date('date'),
    titleBn: text('title_bn'),
    titleEn: text('title_en'),
    pdfUrl: text('pdf_url'),
    committeeId: integer('committee_id').references(() => committees.id, { onDelete: 'set null' }),
    sourceUrl: text('source_url'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notices_date_idx').on(t.date), index('notices_committee_idx').on(t.committeeId)],
);

export const noticeMembers = sangsadSchema.table(
  'notice_members',
  {
    id: serial('id').primaryKey(),
    noticeId: integer('notice_id')
      .notNull()
      .references(() => notices.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    /** 'seat' when the title carried the seat number, 'name' when only the name matched. */
    matchedBy: text('matched_by').notNull(),
  },
  (t) => [unique('notice_members_pair').on(t.noticeId, t.memberId), index('notice_members_member_idx').on(t.memberId)],
);

/* ---------------- biography ---------------- */

export const bioFacts = sangsadSchema.table(
  'bio_facts',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    /** e.g. previous_position, political_history, notable_event, education */
    field: text('field').notNull(),
    valueBn: text('value_bn'),
    valueEn: text('value_en'),
    /** Verified requires two trusted sources, or one plus an official one (enforced in the admin). */
    status: verifyStatusEnum('status').notNull().default('pending'),
    verifiedBy: uuid('verified_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('bio_facts_member_idx').on(t.memberId)],
);

export const bioFactSources = sangsadSchema.table('bio_fact_sources', {
  id: serial('id').primaryKey(),
  bioFactId: integer('bio_fact_id')
    .notNull()
    .references(() => bioFacts.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').references(() => sources.id),
  url: text('url').notNull(),
  /** Official sources (parliament, ECS) count double; see the verification rule. */
  isOfficial: boolean('is_official').notNull().default(false),
});

/* ---------------- news ---------------- */

export const sourceTypeEnum = sangsadSchema.enum('source_type', ['portal', 'tv', 'official', 'verification']);
export const sourceStatusEnum = sangsadSchema.enum('source_status', ['active', 'no_feed', 'blocked', 'disabled', 'pending_inspection']);

/** Mirrors config/sources.json; the worker upserts it on every run. */
export const sources = sangsadSchema.table('sources', {
  id: text('id').primaryKey(),
  nameBn: text('name_bn').notNull(),
  nameEn: text('name_en').notNull(),
  type: sourceTypeEnum('type').notNull(),
  homepage: text('homepage'),
  rssUrls: jsonb('rss_urls').$type<string[]>().notNull().default([]),
  youtubeChannelId: text('youtube_channel_id'),
  /** Link only; Facebook is never scraped. */
  facebookUrl: text('facebook_url'),
  logoUrl: text('logo_url'),
  language: text('language'),
  status: sourceStatusEnum('status').notNull().default('pending_inspection'),
  notes: text('notes'),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
});

export const articles = sangsadSchema.table(
  'articles',
  {
    id: serial('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    url: text('url').notNull().unique(),
    title: text('title').notNull(),
    /** The feed's own summary, cut to 160 characters. Never a body, never rewritten. */
    summaryShort: text('summary_short'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    language: text('language'),
  },
  (t) => [index('articles_published_idx').on(t.publishedAt), index('articles_source_idx').on(t.sourceId)],
);

export const videos = sangsadSchema.table(
  'videos',
  {
    id: serial('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    youtubeId: text('youtube_id').notNull().unique(),
    title: text('title').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** YouTube-hosted thumbnail; never downloaded. */
    thumbnailUrl: text('thumbnail_url'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('videos_published_idx').on(t.publishedAt)],
);

export const matchStatusEnum = sangsadSchema.enum('match_status', ['auto', 'approved', 'rejected', 'pending']);

export const articleMembers = sangsadSchema.table(
  'article_members',
  {
    id: serial('id').primaryKey(),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    /** Why the matcher decided what it did, for the reviewer. */
    matchReason: text('match_reason').notNull(),
    status: matchStatusEnum('status').notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('article_members_pair').on(t.articleId, t.memberId),
    index('article_members_member_idx').on(t.memberId, t.status),
  ],
);

export const videoMembers = sangsadSchema.table(
  'video_members',
  {
    id: serial('id').primaryKey(),
    videoId: integer('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    matchReason: text('match_reason').notNull(),
    status: matchStatusEnum('status').notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique('video_members_pair').on(t.videoId, t.memberId), index('video_members_member_idx').on(t.memberId, t.status)],
);

/* ---------------- editorial operations ---------------- */

export const correctionStatusEnum = sangsadSchema.enum('correction_status', ['open', 'resolved', 'rejected']);

export const corrections = sangsadSchema.table('corrections', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id, { onDelete: 'set null' }),
  pagePath: text('page_path'),
  field: text('field'),
  message: text('message').notNull(),
  submittedByEmail: text('submitted_by_email'),
  status: correctionStatusEnum('status').notNull().default('open'),
  resolution: text('resolution'),
  resolvedBy: uuid('resolved_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLog = sangsadSchema.table(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorId: uuid('actor_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    tableName: text('table_name').notNull(),
    rowId: text('row_id'),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_table_row_idx').on(t.tableName, t.rowId)],
);

export const ingestRuns = sangsadSchema.table(
  'ingest_runs',
  {
    id: serial('id').primaryKey(),
    job: text('job').notNull(),
    sourceId: text('source_id').references(() => sources.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ok: boolean('ok'),
    itemsFound: integer('items_found').notNull().default(0),
    itemsNew: integer('items_new').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    errorText: text('error_text'),
  },
  (t) => [index('ingest_runs_job_idx').on(t.job, t.startedAt)],
);

export const adminRoleEnum = sangsadSchema.enum('admin_role', ['admin', 'editor']);

/** Who may use /admin. user_id is the Supabase Auth user id. */
export const adminUsers = sangsadSchema.table('admin_users', {
  userId: uuid('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  role: adminRoleEnum('role').notNull().default('editor'),
  createdAt: createdAt(),
});
