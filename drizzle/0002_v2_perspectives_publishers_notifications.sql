CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."media_lean" AS ENUM('left', 'lean_left', 'center', 'lean_right', 'right', 'unrated');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('new_story', 'comment_reply', 'moderation', 'appeal', 'weekly_summary');--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"lean" "media_lean" DEFAULT 'unrated' NOT NULL,
	"lean_basis" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_name_unique" UNIQUE("name"),
	CONSTRAINT "publishers_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "publisher_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "perspectives" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "scheduled_publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "scheduled_by" uuid;--> statement-breakpoint
ALTER TABLE "story_versions" ADD COLUMN "perspectives" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_versions" ADD COLUMN "balance_check" jsonb;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_outbox_status_idx" ON "email_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_idx" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;