CREATE TABLE "sangsad"."notice_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"notice_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"matched_by" text NOT NULL,
	CONSTRAINT "notice_members_pair" UNIQUE("notice_id","member_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "sangsad"."parties" DROP CONSTRAINT "parties_short_name_unique";--> statement-breakpoint
ALTER TABLE "sangsad"."member_aliases" ALTER COLUMN "added_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sangsad"."committees" ADD COLUMN "source_member_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "seat_label_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "seat_label_en" text;--> statement-breakpoint
ALTER TABLE "sangsad"."member_terms" ADD COLUMN "matched_by" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "photo_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "profession_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "father_name_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "mother_name_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "present_address_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "official_email" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "is_freedom_fighter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "official_summary_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "official_bio_bn" text;--> statement-breakpoint
ALTER TABLE "sangsad"."members" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sangsad"."notice_members" ADD CONSTRAINT "notice_members_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "sangsad"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."notice_members" ADD CONSTRAINT "notice_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "sangsad"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."notices" ADD CONSTRAINT "notices_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "sangsad"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."parliament_sessions" ADD CONSTRAINT "parliament_sessions_parliament_id_parliaments_id_fk" FOREIGN KEY ("parliament_id") REFERENCES "sangsad"."parliaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sangsad"."sittings" ADD CONSTRAINT "sittings_session_id_parliament_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sangsad"."parliament_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_members_member_idx" ON "sangsad"."notice_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "notices_date_idx" ON "sangsad"."notices" USING btree ("date");--> statement-breakpoint
CREATE INDEX "notices_committee_idx" ON "sangsad"."notices" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "sittings_date_idx" ON "sangsad"."sittings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "members_person_idx" ON "sangsad"."members" USING btree ("source_person_id");--> statement-breakpoint
ALTER TABLE "sangsad"."committees" ADD CONSTRAINT "committees_source_id_unique" UNIQUE("source_id");--> statement-breakpoint
ALTER TABLE "sangsad"."parties" ADD CONSTRAINT "parties_source_id_unique" UNIQUE("source_id");