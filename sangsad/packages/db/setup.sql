-- সংসদ engine for mymp.bd: one-shot setup for Supabase's SQL Editor.
-- Generated from packages/db/migrations + sql/rls.sql on 2026-09-30.
-- Safe to run once on a fresh project. Afterwards use `pnpm db:migrate` for new migrations.

create schema if not exists drizzle;
create schema if not exists sangsad;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

-- ---------------- migration 0000_init ----------------
CREATE TYPE "sangsad"."admin_role" AS ENUM('admin', 'editor');
CREATE TYPE "sangsad"."alias_language" AS ENUM('bn', 'en');
CREATE TYPE "sangsad"."correction_status" AS ENUM('open', 'resolved', 'rejected');
CREATE TYPE "sangsad"."extraction_method" AS ENUM('text', 'ocr', 'manual');
CREATE TYPE "sangsad"."gender" AS ENUM('male', 'female', 'other', 'unknown');
CREATE TYPE "sangsad"."match_status" AS ENUM('auto', 'approved', 'rejected', 'pending');
CREATE TYPE "sangsad"."source_status" AS ENUM('active', 'no_feed', 'blocked', 'disabled', 'pending_inspection');
CREATE TYPE "sangsad"."source_type" AS ENUM('portal', 'tv', 'official', 'verification');
CREATE TYPE "sangsad"."verify_status" AS ENUM('pending', 'verified', 'rejected');
CREATE TABLE "sangsad"."admin_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "sangsad"."admin_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);

CREATE TABLE "sangsad"."affidavit_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"affidavit_id" integer NOT NULL,
	"case_description" text NOT NULL,
	"status" text,
	"source_page" integer
);

CREATE TABLE "sangsad"."affidavits" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"parliament_id" integer NOT NULL,
	"pdf_url" text NOT NULL,
	"stored_pdf_path" text,
	"education" text,
	"profession" text,
	"annual_income" text,
	"total_assets" text,
	"liabilities" text,
	"raw_text" text,
	"extraction_method" "sangsad"."extraction_method" DEFAULT 'text' NOT NULL,
	"status" "sangsad"."verify_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affidavits_member_parliament" UNIQUE("member_id","parliament_id")
);

CREATE TABLE "sangsad"."article_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"match_reason" text NOT NULL,
	"status" "sangsad"."match_status" NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_members_pair" UNIQUE("article_id","member_id")
);

CREATE TABLE "sangsad"."articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"summary_short" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"language" text,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);

CREATE TABLE "sangsad"."audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"row_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sangsad"."bio_fact_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"bio_fact_id" integer NOT NULL,
	"source_id" text,
	"url" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL
);

CREATE TABLE "sangsad"."bio_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"field" text NOT NULL,
	"value_bn" text,
	"value_en" text,
	"status" "sangsad"."verify_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sangsad"."committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"parliament_id" integer NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text,
	"slug" text NOT NULL,
	"type" text,
	"roster_current" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"source_id" integer,
	"source_url" text,
	CONSTRAINT "committees_parliament_slug" UNIQUE("parliament_id","slug")
);

CREATE TABLE "sangsad"."constituencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"parliament_id" integer NOT NULL,
	"number" integer NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"district_id" integer,
	"is_reserved_women" boolean DEFAULT false NOT NULL,
	"boundary_bn" text,
	"source_id" integer,
	"source_url" text,
	CONSTRAINT "constituencies_parliament_number" UNIQUE("parliament_id","number"),
	CONSTRAINT "constituencies_parliament_slug" UNIQUE("parliament_id","slug")
);

CREATE TABLE "sangsad"."corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"page_path" text,
	"field" text,
	"message" text NOT NULL,
	"submitted_by_email" text,
	"status" "sangsad"."correction_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sangsad"."districts" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_id" integer NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"source_id" integer,
	CONSTRAINT "districts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "districts_source_id_unique" UNIQUE("source_id")
);

CREATE TABLE "sangsad"."divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"source_id" integer,
	CONSTRAINT "divisions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "divisions_source_id_unique" UNIQUE("source_id")
);

CREATE TABLE "sangsad"."election_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"parliament_id" integer NOT NULL,
	"constituency_id" integer NOT NULL,
	"candidate_name" text NOT NULL,
	"party_id" integer,
	"party_label" text,
	"votes" integer,
	"is_winner" boolean DEFAULT false NOT NULL,
	"turnout" numeric(5, 2),
	"source_url" text NOT NULL,
	"stored_pdf_path" text,
	"status" "sangsad"."verify_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sangsad"."ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"source_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"items_found" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"error_text" text
);

CREATE TABLE "sangsad"."member_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"alias" text NOT NULL,
	"language" "sangsad"."alias_language" NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_aliases_member_alias" UNIQUE("member_id","alias")
);

CREATE TABLE "sangsad"."member_committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"role" text DEFAULT 'Member' NOT NULL,
	CONSTRAINT "member_committees_pair" UNIQUE("committee_id","member_id")
);

CREATE TABLE "sangsad"."member_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"parliament_id" integer NOT NULL,
	"constituency_id" integer,
	"party_id" integer,
	"role" text DEFAULT 'MP' NOT NULL,
	"start_date" date,
	"end_date" date,
	"source_url" text,
	CONSTRAINT "member_terms_member_parliament_role" UNIQUE("member_id","parliament_id","role")
);

CREATE TABLE "sangsad"."members" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text,
	"photo_url" text,
	"photo_source_url" text,
	"date_of_birth" date,
	"gender" "sangsad"."gender" DEFAULT 'unknown' NOT NULL,
	"source_external_id" text,
	"source_person_id" integer,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_slug_unique" UNIQUE("slug"),
	CONSTRAINT "members_source_external_id_unique" UNIQUE("source_external_id")
);

CREATE TABLE "sangsad"."parliaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"election_date" date,
	"start_date" date,
	"end_date" date,
	"source_election_id" integer,
	CONSTRAINT "parliaments_number_unique" UNIQUE("number")
);

CREATE TABLE "sangsad"."parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"short_name" text NOT NULL,
	"color" text,
	"source_id" integer,
	CONSTRAINT "parties_short_name_unique" UNIQUE("short_name")
);

CREATE TABLE "sangsad"."sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"type" "sangsad"."source_type" NOT NULL,
	"homepage" text,
	"rss_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"youtube_channel_id" text,
	"facebook_url" text,
	"logo_url" text,
	"language" text,
	"status" "sangsad"."source_status" DEFAULT 'pending_inspection' NOT NULL,
	"notes" text,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "sangsad"."video_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"match_reason" text NOT NULL,
	"status" "sangsad"."match_status" NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_members_pair" UNIQUE("video_id","member_id")
);

CREATE TABLE "sangsad"."videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp with time zone,
	"thumbnail_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_youtube_id_unique" UNIQUE("youtube_id")
);

ALTER TABLE "sangsad"."affidavit_cases" ADD CONSTRAINT "affidavit_cases_affidavit_id_affidavits_id_fk" FOREIGN KEY ("affidavit_id") REFERENCES "sangsad"."affidavits"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."affidavits" ADD CONSTRAINT "affidavits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."affidavits" ADD CONSTRAINT "affidavits_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."article_members" ADD CONSTRAINT "article_members_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "sangsad"."articles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."article_members" ADD CONSTRAINT "article_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."bio_fact_sources" ADD CONSTRAINT "bio_fact_sources_bio_fact_id_bio_facts_id_fk" FOREIGN KEY ("bio_fact_id") REFERENCES "sangsad"."bio_facts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."bio_fact_sources" ADD CONSTRAINT "bio_fact_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."bio_facts" ADD CONSTRAINT "bio_facts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."committees" ADD CONSTRAINT "committees_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."constituencies" ADD CONSTRAINT "constituencies_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."constituencies" ADD CONSTRAINT "constituencies_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "sangsad"."districts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."corrections" ADD CONSTRAINT "corrections_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sangsad"."districts" ADD CONSTRAINT "districts_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "sangsad"."divisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_constituency_id_constituencies_id_fk" FOREIGN KEY ("constituency_id") REFERENCES "sangsad"."constituencies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "sangsad"."parties"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."ingest_runs" ADD CONSTRAINT "ingest_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."member_aliases" ADD CONSTRAINT "member_aliases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."member_committees" ADD CONSTRAINT "member_committees_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "sangsad"."committees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."member_committees" ADD CONSTRAINT "member_committees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_constituency_id_constituencies_id_fk" FOREIGN KEY ("constituency_id") REFERENCES "sangsad"."constituencies"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "sangsad"."parties"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."video_members" ADD CONSTRAINT "video_members_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "sangsad"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."video_members" ADD CONSTRAINT "video_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."videos" ADD CONSTRAINT "videos_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "article_members_member_idx" ON "sangsad"."article_members" USING btree ("member_id","status");
CREATE INDEX "articles_published_idx" ON "sangsad"."articles" USING btree ("published_at");
CREATE INDEX "articles_source_idx" ON "sangsad"."articles" USING btree ("source_id");
CREATE INDEX "audit_log_table_row_idx" ON "sangsad"."audit_log" USING btree ("table_name","row_id");
CREATE INDEX "bio_facts_member_idx" ON "sangsad"."bio_facts" USING btree ("member_id");
CREATE INDEX "constituencies_district_idx" ON "sangsad"."constituencies" USING btree ("district_id");
CREATE INDEX "districts_division_idx" ON "sangsad"."districts" USING btree ("division_id");
CREATE INDEX "election_results_constituency_idx" ON "sangsad"."election_results" USING btree ("parliament_id","constituency_id");
CREATE INDEX "ingest_runs_job_idx" ON "sangsad"."ingest_runs" USING btree ("job","started_at");
CREATE INDEX "member_aliases_alias_idx" ON "sangsad"."member_aliases" USING btree ("alias");
CREATE INDEX "member_terms_parliament_idx" ON "sangsad"."member_terms" USING btree ("parliament_id");
CREATE INDEX "member_terms_constituency_idx" ON "sangsad"."member_terms" USING btree ("constituency_id");
CREATE INDEX "members_name_bn_idx" ON "sangsad"."members" USING btree ("name_bn");
CREATE INDEX "video_members_member_idx" ON "sangsad"."video_members" USING btree ("member_id","status");
CREATE INDEX "videos_published_idx" ON "sangsad"."videos" USING btree ("published_at");

-- ---------------- migration 0001_house_activity ----------------
CREATE TABLE "sangsad"."notice_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"notice_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"matched_by" text NOT NULL,
	CONSTRAINT "notice_members_pair" UNIQUE("notice_id","member_id")
);

CREATE TABLE "sangsad"."notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"date" date,
	"title_bn" text,
	"title_en" text,
	"pdf_url" text,
	"committee_id" integer,
	"source_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notices_source_id_unique" UNIQUE("source_id")
);

CREATE TABLE "sangsad"."parliament_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"parliament_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"title_bn" text,
	"title_en" text,
	"start_date" date,
	"end_date" date,
	"source_url" text,
	CONSTRAINT "parliament_sessions_source_id_unique" UNIQUE("source_id")
);

CREATE TABLE "sangsad"."sittings" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"title_bn" text,
	"date" date,
	"pdf_url" text,
	"circular_no" integer,
	CONSTRAINT "sittings_source_id_unique" UNIQUE("source_id")
);

ALTER TABLE "sangsad"."parties" DROP CONSTRAINT "parties_short_name_unique";
ALTER TABLE "sangsad"."member_aliases" ALTER COLUMN "added_by" SET DATA TYPE text;
ALTER TABLE "sangsad"."committees" ADD COLUMN "source_member_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "seat_label_bn" text;
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "seat_label_en" text;
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "matched_by" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "photo_checked_at" timestamp with time zone;
ALTER TABLE "sangsad"."members" ADD COLUMN "profession_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "father_name_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "mother_name_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "present_address_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "official_email" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "is_freedom_fighter" boolean DEFAULT false NOT NULL;
ALTER TABLE "sangsad"."members" ADD COLUMN "official_summary_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "official_bio_bn" text;
ALTER TABLE "sangsad"."members" ADD COLUMN "source_updated_at" timestamp with time zone;
ALTER TABLE "sangsad"."notice_members" ADD CONSTRAINT "notice_members_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "sangsad"."notices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."notice_members" ADD CONSTRAINT "notice_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sangsad"."notices" ADD CONSTRAINT "notices_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "sangsad"."committees"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sangsad"."parliament_sessions" ADD CONSTRAINT "parliament_sessions_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sangsad"."sittings" ADD CONSTRAINT "sittings_session_id_parliament_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sangsad"."parliament_sessions"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "notice_members_member_idx" ON "sangsad"."notice_members" USING btree ("member_id");
CREATE INDEX "notices_date_idx" ON "sangsad"."notices" USING btree ("date");
CREATE INDEX "notices_committee_idx" ON "sangsad"."notices" USING btree ("committee_id");
CREATE INDEX "sittings_date_idx" ON "sangsad"."sittings" USING btree ("date");
CREATE INDEX "members_person_idx" ON "sangsad"."members" USING btree ("source_person_id");
ALTER TABLE "sangsad"."committees" ADD CONSTRAINT "committees_source_id_unique" UNIQUE("source_id");
ALTER TABLE "sangsad"."parties" ADD CONSTRAINT "parties_source_id_unique" UNIQUE("source_id");

-- ---------------- row level security ----------------
-- Row Level Security for the সংসদ engine behind mymp.bd.
-- Idempotent: re-run after every migration. The service role bypasses RLS,
-- so workers and admin server actions write freely; anon and authenticated
-- (the browser, PostgREST) may read published rows only and can never write.
--
-- Privileges and policies are both explicit here. Supabase grants anon and
-- authenticated everything on new tables by default; a bare Postgres grants
-- nothing. This file makes both behave the same: every table starts with no
-- sangsad privilege, and a SELECT grant appears only together with a policy.

grant usage on schema sangsad to anon, authenticated;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'sangsad'
      and tablename not like '__drizzle%'
  loop
    execute format('alter table sangsad.%I enable row level security', t);
    execute format('revoke all on sangsad.%I from anon, authenticated', t);
  end loop;
end $$;

-- helper: drop-then-create keeps this file re-runnable; the grant travels with the policy
create or replace function sangsad._policy(tbl text, name text, using_expr text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on sangsad.%I', name, tbl);
  execute format('create policy %I on sangsad.%I for select to anon, authenticated using (%s)', name, tbl, using_expr);
  execute format('grant select on sangsad.%I to anon, authenticated', tbl);
end $$;

-- reference data: fully sangsad
select sangsad._policy('parliaments',   'sangsad_read', 'true');
select sangsad._policy('parties',       'sangsad_read', 'true');
select sangsad._policy('divisions',     'sangsad_read', 'true');
select sangsad._policy('districts',     'sangsad_read', 'true');
select sangsad._policy('constituencies','sangsad_read', 'true');
select sangsad._policy('members',       'sangsad_read', 'true');
select sangsad._policy('member_terms',  'sangsad_read', 'true');
select sangsad._policy('committees',    'sangsad_read', 'true');
select sangsad._policy('member_committees', 'sangsad_read', 'true');
select sangsad._policy('sources',       'sangsad_read', 'status = ''active''');

-- what the House is doing: official, sangsad
select sangsad._policy('parliament_sessions', 'sangsad_read', 'true');
select sangsad._policy('sittings',            'sangsad_read', 'true');
select sangsad._policy('notices',             'sangsad_read', 'true');
select sangsad._policy('notice_members',      'sangsad_read', 'true');

-- editorial data: only what an editor verified
select sangsad._policy('election_results', 'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('affidavits',       'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('affidavit_cases',  'sangsad_read_verified',
  'exists (select 1 from sangsad.affidavits a where a.id = affidavit_id and a.status = ''verified'')');
select sangsad._policy('bio_facts',        'sangsad_read_verified', 'status = ''verified''');
select sangsad._policy('bio_fact_sources', 'sangsad_read_verified',
  'exists (select 1 from sangsad.bio_facts f where f.id = bio_fact_id and f.status = ''verified'')');

-- news: headlines are sangsad; a match is sangsad only when auto-published or approved
select sangsad._policy('articles',        'sangsad_read', 'true');
select sangsad._policy('videos',          'sangsad_read', 'true');
select sangsad._policy('article_members', 'sangsad_read_published', 'status in (''auto'', ''approved'')');
select sangsad._policy('video_members',   'sangsad_read_published', 'status in (''auto'', ''approved'')');

-- never sangsad: member_aliases, corrections, audit_log, ingest_runs, admin_users
-- (no policy and no SELECT grant: a sangsad read is refused outright)
drop policy if exists sangsad_read on sangsad.member_aliases;
drop policy if exists sangsad_read on sangsad.corrections;
drop policy if exists sangsad_read on sangsad.audit_log;
drop policy if exists sangsad_read on sangsad.ingest_runs;
drop policy if exists sangsad_read on sangsad.admin_users;

-- the sangsad correction form may INSERT, nothing else, and only open rows with no resolution
drop policy if exists sangsad_submit on sangsad.corrections;
create policy sangsad_submit on sangsad.corrections for insert to anon, authenticated
  with check (status = 'open' and resolution is null and resolved_by is null);
grant insert on sangsad.corrections to anon, authenticated;
grant usage, select on sequence sangsad.corrections_id_seq to anon, authenticated;

grant usage on schema sangsad to service_role;
grant all on all tables in schema sangsad to service_role;
grant usage, select on all sequences in schema sangsad to service_role;
alter default privileges in schema sangsad grant all on tables to service_role;
alter default privileges in schema sangsad grant usage, select on sequences to service_role;

-- ---------------- record the migrations as applied ----------------
insert into drizzle.__drizzle_migrations (hash, created_at)
  select 'c70b656ba811c0a36c9016c1930d4701f8990e2d801050a6a9a65cfcdfa6bd35', 1789031981133
  where not exists (select 1 from drizzle.__drizzle_migrations where hash = 'c70b656ba811c0a36c9016c1930d4701f8990e2d801050a6a9a65cfcdfa6bd35');
insert into drizzle.__drizzle_migrations (hash, created_at)
  select '0caeeba8572932e8da07d54776ab765837c48a85cf62f8825f220a3ee88c7f92', 1789034228553
  where not exists (select 1 from drizzle.__drizzle_migrations where hash = '0caeeba8572932e8da07d54776ab765837c48a85cf62f8825f220a3ee88c7f92');
