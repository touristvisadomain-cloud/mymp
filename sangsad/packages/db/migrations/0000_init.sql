CREATE TYPE "sangsad"."admin_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "sangsad"."alias_language" AS ENUM('bn', 'en');--> statement-breakpoint
CREATE TYPE "sangsad"."correction_status" AS ENUM('open', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "sangsad"."extraction_method" AS ENUM('text', 'ocr', 'manual');--> statement-breakpoint
CREATE TYPE "sangsad"."gender" AS ENUM('male', 'female', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "sangsad"."match_status" AS ENUM('auto', 'approved', 'rejected', 'pending');--> statement-breakpoint
CREATE TYPE "sangsad"."source_status" AS ENUM('active', 'no_feed', 'blocked', 'disabled', 'pending_inspection');--> statement-breakpoint
CREATE TYPE "sangsad"."source_type" AS ENUM('portal', 'tv', 'official', 'verification');--> statement-breakpoint
CREATE TYPE "sangsad"."verify_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "sangsad"."admin_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "sangsad"."admin_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sangsad"."affidavit_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"affidavit_id" integer NOT NULL,
	"case_description" text NOT NULL,
	"status" text,
	"source_page" integer
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sangsad"."bio_fact_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"bio_fact_id" integer NOT NULL,
	"source_id" text,
	"url" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sangsad"."divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"source_id" integer,
	CONSTRAINT "divisions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "divisions_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sangsad"."member_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"alias" text NOT NULL,
	"language" "sangsad"."alias_language" NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_aliases_member_alias" UNIQUE("member_id","alias")
);
--> statement-breakpoint
CREATE TABLE "sangsad"."member_committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"role" text DEFAULT 'Member' NOT NULL,
	CONSTRAINT "member_committees_pair" UNIQUE("committee_id","member_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sangsad"."parliaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"election_date" date,
	"start_date" date,
	"end_date" date,
	"source_election_id" integer,
	CONSTRAINT "parliaments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "sangsad"."parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"short_name" text NOT NULL,
	"color" text,
	"source_id" integer,
	CONSTRAINT "parties_short_name_unique" UNIQUE("short_name")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "sangsad"."affidavit_cases" ADD CONSTRAINT "affidavit_cases_affidavit_id_affidavits_id_fk" FOREIGN KEY ("affidavit_id") REFERENCES "sangsad"."affidavits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."affidavits" ADD CONSTRAINT "affidavits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."affidavits" ADD CONSTRAINT "affidavits_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."article_members" ADD CONSTRAINT "article_members_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "sangsad"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."article_members" ADD CONSTRAINT "article_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."bio_fact_sources" ADD CONSTRAINT "bio_fact_sources_bio_fact_id_bio_facts_id_fk" FOREIGN KEY ("bio_fact_id") REFERENCES "sangsad"."bio_facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."bio_fact_sources" ADD CONSTRAINT "bio_fact_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."bio_facts" ADD CONSTRAINT "bio_facts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."committees" ADD CONSTRAINT "committees_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."constituencies" ADD CONSTRAINT "constituencies_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."constituencies" ADD CONSTRAINT "constituencies_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "sangsad"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."corrections" ADD CONSTRAINT "corrections_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."districts" ADD CONSTRAINT "districts_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "sangsad"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_constituency_id_constituencies_id_fk" FOREIGN KEY ("constituency_id") REFERENCES "sangsad"."constituencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."election_results" ADD CONSTRAINT "election_results_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "sangsad"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."ingest_runs" ADD CONSTRAINT "ingest_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_aliases" ADD CONSTRAINT "member_aliases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_committees" ADD CONSTRAINT "member_committees_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "sangsad"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_committees" ADD CONSTRAINT "member_committees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_constituency_id_constituencies_id_fk" FOREIGN KEY ("constituency_id") REFERENCES "sangsad"."constituencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD CONSTRAINT "member_terms_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "sangsad"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."video_members" ADD CONSTRAINT "video_members_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "sangsad"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."video_members" ADD CONSTRAINT "video_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."videos" ADD CONSTRAINT "videos_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "sangsad"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_members_member_idx" ON "sangsad"."article_members" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "sangsad"."articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_source_idx" ON "sangsad"."articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "audit_log_table_row_idx" ON "sangsad"."audit_log" USING btree ("table_name","row_id");--> statement-breakpoint
CREATE INDEX "bio_facts_member_idx" ON "sangsad"."bio_facts" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "constituencies_district_idx" ON "sangsad"."constituencies" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "districts_division_idx" ON "sangsad"."districts" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "election_results_constituency_idx" ON "sangsad"."election_results" USING btree ("parliament_id","constituency_id");--> statement-breakpoint
CREATE INDEX "ingest_runs_job_idx" ON "sangsad"."ingest_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "member_aliases_alias_idx" ON "sangsad"."member_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "member_terms_parliament_idx" ON "sangsad"."member_terms" USING btree ("parliament_id");--> statement-breakpoint
CREATE INDEX "member_terms_constituency_idx" ON "sangsad"."member_terms" USING btree ("constituency_id");--> statement-breakpoint
CREATE INDEX "members_name_bn_idx" ON "sangsad"."members" USING btree ("name_bn");--> statement-breakpoint
CREATE INDEX "video_members_member_idx" ON "sangsad"."video_members" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "videos_published_idx" ON "sangsad"."videos" USING btree ("published_at");