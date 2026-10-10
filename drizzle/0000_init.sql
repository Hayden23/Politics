CREATE TYPE "public"."account_status" AS ENUM('active', 'restricted', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."appeal_status" AS ENUM('open', 'upheld', 'overturned');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('new', 'promoted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('active', 'removed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('dismiss_report', 'remove_content', 'restore_content', 'warn', 'restrict', 'suspend', 'reinstate', 'escalate');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('seven_point_scale');--> statement-breakpoint
CREATE TYPE "public"."source_relationship" AS ENUM('primary_evidence', 'factual_reporting', 'analysis', 'contextual_background');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'escalated', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('comment', 'story', 'user');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('scale', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('news_article', 'primary_document', 'government_data', 'analysis', 'other');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"story_id" uuid,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"moderation_action_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "appeal_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "appeals_one_per_action" UNIQUE("moderation_action_id")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_story_id_pk" PRIMARY KEY("user_id","story_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"publisher_name" text,
	"summary" text,
	"feed_name" text,
	"published_at" timestamp with time zone,
	"status" "candidate_status" DEFAULT 'new' NOT NULL,
	"duplicate_of" uuid,
	"story_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_stories_normalized_url_unique" UNIQUE("normalized_url")
);
--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_unique" UNIQUE("comment_id","user_id","reaction_type"),
	CONSTRAINT "reaction_type_allowed" CHECK ("comment_reactions"."reaction_type" IN ('insightful'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'active' NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consent_type" text NOT NULL,
	"consent_version" text NOT NULL,
	"granted" boolean NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"assigned_moderator_id" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "editorial_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"digest" text,
	"path" text,
	"stack" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hidden_comments" (
	"user_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hidden_comments_user_id_comment_id_pk" PRIMARY KEY("user_id","comment_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" uuid,
	"target_user_id" uuid,
	"report_id" uuid,
	"comment_id" uuid,
	"action" "moderation_action" NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" "question_type" DEFAULT 'seven_point_scale' NOT NULL,
	"scale_config" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	CONSTRAINT "questions_story_version_unique" UNIQUE("story_id","version")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rating_id" uuid NOT NULL,
	"previous_value" smallint,
	"previous_type" "response_type",
	"new_value" smallint,
	"new_type" "response_type",
	"question_version" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_version" integer NOT NULL,
	"response_value" smallint,
	"response_type" "response_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_question_unique" UNIQUE("user_id","question_id"),
	CONSTRAINT "ratings_value_matches_type" CHECK (("ratings"."response_type" = 'scale' AND "ratings"."response_value" BETWEEN 1 AND 7) OR ("ratings"."response_type" = 'uncertain' AND "ratings"."response_value" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_name" text NOT NULL,
	"original_headline" text,
	"author" text,
	"source_url" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone,
	"rights_status" text,
	"correction_status" text,
	"link_status" text DEFAULT 'unchecked' NOT NULL,
	"link_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"headline" text NOT NULL,
	"briefing" text NOT NULL,
	"key_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disputed_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncertainties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic_id" uuid,
	"event_at" timestamp with time zone,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"editorial_priority" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "story_sources" (
	"story_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"story_version" integer NOT NULL,
	"relationship_type" "source_relationship" NOT NULL,
	"claims_supported" jsonb,
	CONSTRAINT "story_sources_story_id_source_id_story_version_pk" PRIMARY KEY("story_id","source_id","story_version")
);
--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"headline" text NOT NULL,
	"briefing" text NOT NULL,
	"key_facts" jsonb NOT NULL,
	"disputed_claims" jsonb NOT NULL,
	"uncertainties" jsonb NOT NULL,
	"ai_draft" jsonb,
	"editorial_notes" text,
	"correction_note" text,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_versions_story_version_unique" UNIQUE("story_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_demographics" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"state_code" char(2),
	"age_range" text,
	"political_self_identification" text,
	"geographic_type" text,
	"consent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"topic_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"frequency":"off"}'::jsonb NOT NULL,
	"privacy_preferences" jsonb DEFAULT '{"showRatingOnComments":false,"includeInDemographicAggregates":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"account_status" "account_status" DEFAULT 'active' NOT NULL,
	"restricted_until" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id")
);
--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_moderation_action_id_moderation_actions_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_stories" ADD CONSTRAINT "candidate_stories_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_assigned_moderator_id_users_id_fk" FOREIGN KEY ("assigned_moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_audit_log" ADD CONSTRAINT "editorial_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_comments" ADD CONSTRAINT "hidden_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_comments" ADD CONSTRAINT "hidden_comments_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_content_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_id_ratings_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_demographics" ADD CONSTRAINT "user_demographics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_name_created_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_subject_idx" ON "analytics_events" USING btree ("subject","created_at");--> statement-breakpoint
CREATE INDEX "appeals_status_idx" ON "appeals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "candidate_status_idx" ON "candidate_stories" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "comments_story_idx" ON "comments" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "comments_question_created_idx" ON "comments" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_user_idx" ON "consent_records" USING btree ("user_id","consent_type");--> statement-breakpoint
CREATE INDEX "content_reports_status_created_idx" ON "content_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "content_reports_target_idx" ON "content_reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "editorial_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "editorial_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_events_created_idx" ON "error_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "questions_story_status_idx" ON "questions" USING btree ("story_id","status");--> statement-breakpoint
CREATE INDEX "rating_history_rating_idx" ON "rating_history" USING btree ("rating_id","changed_at");--> statement-breakpoint
CREATE INDEX "ratings_question_value_idx" ON "ratings" USING btree ("question_id","response_value");--> statement-breakpoint
CREATE INDEX "ratings_user_question_idx" ON "ratings" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sources_publisher_idx" ON "sources" USING btree ("publisher_name");--> statement-breakpoint
CREATE INDEX "sources_url_idx" ON "sources" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "stories_status_published_idx" ON "stories" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "stories_topic_idx" ON "stories" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email")) WHERE "users"."email" IS NOT NULL;