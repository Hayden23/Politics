import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const id = () => uuid("id").primaryKey().defaultRandom();

// ───────────── Enums ─────────────

export const roleEnum = pgEnum("user_role", ["user", "moderator", "editor", "admin"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "restricted", "suspended", "deleted"]);
export const storyStatusEnum = pgEnum("story_status", ["draft", "in_review", "approved", "published", "unpublished", "archived"]);
export const questionStatusEnum = pgEnum("question_status", ["draft", "published", "retired"]);
export const questionTypeEnum = pgEnum("question_type", ["seven_point_scale"]);
export const responseTypeEnum = pgEnum("response_type", ["scale", "uncertain"]);
export const commentStatusEnum = pgEnum("comment_status", ["active", "removed", "deleted"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "escalated", "resolved", "dismissed"]);
export const reportTargetEnum = pgEnum("report_target", ["comment", "story", "user"]);
export const sourceTypeEnum = pgEnum("source_type", ["news_article", "primary_document", "government_data", "analysis", "other"]);
export const relationshipEnum = pgEnum("source_relationship", ["primary_evidence", "factual_reporting", "analysis", "contextual_background"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["new", "promoted", "dismissed"]);
export const moderationActionEnum = pgEnum("moderation_action", ["dismiss_report", "remove_content", "restore_content", "warn", "restrict", "suspend", "reinstate", "escalate"]);
export const leanEnum = pgEnum("media_lean", ["left", "lean_left", "center", "lean_right", "right", "unrated"]);
export const notificationKindEnum = pgEnum("notification_kind", ["new_story", "comment_reply", "moderation", "appeal", "weekly_summary"]);
export const emailStatusEnum = pgEnum("email_status", ["pending", "sent", "failed", "skipped"]);
export const appealStatusEnum = pgEnum("appeal_status", ["open", "upheld", "overturned"]);

// ───────────── Identity ─────────────

export const users = pgTable("users", {
  id: id(),
  authProviderId: text("auth_provider_id").notNull().unique(),
  email: text("email"),
  displayName: text("display_name"),
  role: roleEnum("role").notNull().default("user"),
  accountStatus: accountStatusEnum("account_status").notNull().default("active"),
  /** Commenting is blocked until this time when account_status is 'restricted'. */
  restrictedUntil: ts("restricted_until"),
  onboardedAt: ts("onboarded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
}, (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL`)]);

/** Password hashes live apart from the profile row. */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  /** sha256 of the cookie token; the token itself is never stored. */
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  topicPreferences: jsonb("topic_preferences").$type<string[]>().notNull().default([]),
  notificationPreferences: jsonb("notification_preferences").$type<{ frequency: "off" | "daily" | "weekly" }>().notNull().default({ frequency: "off" }),
  privacyPreferences: jsonb("privacy_preferences").$type<{ showRatingOnComments: boolean; includeInDemographicAggregates: boolean }>().notNull().default({ showRatingOnComments: false, includeInDemographicAggregates: false }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Sensitive, optional, separately permissioned. Never joined into public queries. */
export const userDemographics = pgTable("user_demographics", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  stateCode: char("state_code", { length: 2 }),
  ageRange: text("age_range"),
  politicalSelfIdentification: text("political_self_identification"),
  geographicType: text("geographic_type"),
  consentAt: ts("consent_at"),
  updatedAt: updatedAt(),
});

export const consentRecords = pgTable("consent_records", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(),
  consentVersion: text("consent_version").notNull(),
  granted: boolean("granted").notNull(),
  recordedAt: ts("recorded_at").notNull().defaultNow(),
}, (t) => [index("consent_user_idx").on(t.userId, t.consentType)]);

// ───────────── Editorial content ─────────────

export const topics = pgTable("topics", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export type FactItem = { text: string; sourceIds?: string[] };

/**
 * How one side of the political spectrum argues and frames a story. Written
 * by editors (optionally from an AI draft), versioned with the story, and
 * shown only after the reader rates.
 */
export type Perspective = {
  side: "left" | "right";
  /** One or two sentences in that side's own terms, attributed. */
  summary: string;
  /** Strongest arguments that side makes, each traceable to sources. */
  arguments: FactItem[];
  /** Words and framing that side tends to use for this issue. */
  framing: string;
  /** Values the side emphasizes (e.g. "fairness", "liberty", "safety"). */
  values: string[];
};

/** Result of an editorial balance check (heuristic and/or AI). */
export type BalanceCheck = {
  checkedAt: string;
  by: "heuristic" | "ai";
  model?: string;
  issues: { kind: string; excerpt?: string; detail: string; suggestion?: string }[];
  stats?: Record<string, number>;
};

export const stories = pgTable("stories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  headline: text("headline").notNull(),
  briefing: text("briefing").notNull(),
  keyFacts: jsonb("key_facts").$type<FactItem[]>().notNull().default([]),
  disputedClaims: jsonb("disputed_claims").$type<FactItem[]>().notNull().default([]),
  uncertainties: jsonb("uncertainties").$type<FactItem[]>().notNull().default([]),
  topicId: uuid("topic_id").references(() => topics.id),
  eventAt: ts("event_at"),
  status: storyStatusEnum("status").notNull().default("draft"),
  currentVersion: integer("current_version").notNull().default(1),
  perspectives: jsonb("perspectives").$type<Perspective[]>().notNull().default([]),
  /** Approved stories can be scheduled; the worker publishes them when due. */
  scheduledPublishAt: ts("scheduled_publish_at"),
  scheduledBy: uuid("scheduled_by").references(() => users.id),
  /** Editors' ordering weight for the feed (0 = normal). Never derived from opinions. */
  editorialPriority: integer("editorial_priority").notNull().default(0),
  publishedAt: ts("published_at"),
  archivedAt: ts("archived_at"),
  createdBy: uuid("created_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("stories_status_published_idx").on(t.status, t.publishedAt), index("stories_topic_idx").on(t.topicId)]);

export const storyVersions = pgTable("story_versions", {
  id: id(),
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  headline: text("headline").notNull(),
  briefing: text("briefing").notNull(),
  keyFacts: jsonb("key_facts").$type<FactItem[]>().notNull(),
  disputedClaims: jsonb("disputed_claims").$type<FactItem[]>().notNull(),
  uncertainties: jsonb("uncertainties").$type<FactItem[]>().notNull(),
  perspectives: jsonb("perspectives").$type<Perspective[]>().notNull().default([]),
  aiDraft: jsonb("ai_draft").$type<Record<string, unknown>>(),
  balanceCheck: jsonb("balance_check").$type<BalanceCheck>(),
  editorialNotes: text("editorial_notes"),
  /** Public note shown to readers when this version corrects an earlier one. */
  correctionNote: text("correction_note"),
  createdBy: uuid("created_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: ts("approved_at"),
  publishedAt: ts("published_at"),
  createdAt: createdAt(),
}, (t) => [unique("story_versions_story_version_unique").on(t.storyId, t.versionNumber)]);

/**
 * Outlet registry. Lean is an editorial label with a stated basis (e.g. an
 * external media-bias rating), used only after rating to show coverage balance.
 */
export const publishers = pgTable("publishers", {
  id: id(),
  name: text("name").notNull().unique(),
  domain: text("domain").unique(),
  lean: leanEnum("lean").notNull().default("unrated"),
  leanBasis: text("lean_basis"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sources = pgTable("sources", {
  id: id(),
  publisherId: uuid("publisher_id").references(() => publishers.id, { onDelete: "set null" }),
  publisherName: text("publisher_name").notNull(),
  originalHeadline: text("original_headline"),
  author: text("author"),
  sourceUrl: text("source_url").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  publishedAt: ts("published_at"),
  retrievedAt: ts("retrieved_at"),
  rightsStatus: text("rights_status"),
  correctionStatus: text("correction_status"),
  /** Result of the most recent link check: ok | broken | unchecked. */
  linkStatus: text("link_status").notNull().default("unchecked"),
  linkCheckedAt: ts("link_checked_at"),
  createdAt: createdAt(),
}, (t) => [index("sources_publisher_idx").on(t.publisherName), index("sources_url_idx").on(t.sourceUrl)]);

export const storySources = pgTable("story_sources", {
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => sources.id),
  storyVersion: integer("story_version").notNull(),
  relationshipType: relationshipEnum("relationship_type").notNull(),
  claimsSupported: jsonb("claims_supported").$type<string[]>(),
}, (t) => [primaryKey({ columns: [t.storyId, t.sourceId, t.storyVersion] })]);

export type ScaleConfig = {
  min: 1;
  max: 7;
  labels: string[];
  allowUncertain: boolean;
  uncertainLabel: string;
  /** Whether support/oppose grouping is meaningful for this question. */
  supportGrouping: boolean;
};

export const questions = pgTable("questions", {
  id: id(),
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: questionTypeEnum("question_type").notNull().default("seven_point_scale"),
  scaleConfig: jsonb("scale_config").$type<ScaleConfig>().notNull(),
  version: integer("version").notNull().default(1),
  status: questionStatusEnum("status").notNull().default("draft"),
  createdAt: createdAt(),
  publishedAt: ts("published_at"),
  retiredAt: ts("retired_at"),
}, (t) => [unique("questions_story_version_unique").on(t.storyId, t.version), index("questions_story_status_idx").on(t.storyId, t.status)]);

// ───────────── Opinions ─────────────

export const ratings = pgTable("ratings", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  questionVersion: integer("question_version").notNull(),
  responseValue: smallint("response_value"),
  responseType: responseTypeEnum("response_type").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("ratings_user_question_unique").on(t.userId, t.questionId),
  index("ratings_question_value_idx").on(t.questionId, t.responseValue),
  index("ratings_user_question_idx").on(t.userId, t.questionId),
  check("ratings_value_matches_type", sql`(${t.responseType} = 'scale' AND ${t.responseValue} BETWEEN 1 AND 7) OR (${t.responseType} = 'uncertain' AND ${t.responseValue} IS NULL)`),
]);

export const ratingHistory = pgTable("rating_history", {
  id: id(),
  ratingId: uuid("rating_id").notNull().references(() => ratings.id, { onDelete: "cascade" }),
  previousValue: smallint("previous_value"),
  previousType: responseTypeEnum("previous_type"),
  newValue: smallint("new_value"),
  newType: responseTypeEnum("new_type"),
  questionVersion: integer("question_version").notNull(),
  changedAt: ts("changed_at").notNull().defaultNow(),
}, (t) => [index("rating_history_rating_idx").on(t.ratingId, t.changedAt)]);

export const bookmarks = pgTable("bookmarks", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.storyId] })]);

// ───────────── Community ─────────────

export const comments = pgTable("comments", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  parentCommentId: uuid("parent_comment_id").references((): any => comments.id),
  body: text("body").notNull(),
  status: commentStatusEnum("status").notNull().default("active"),
  editedAt: ts("edited_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deleted_at"),
}, (t) => [
  index("comments_story_idx").on(t.storyId),
  index("comments_question_created_idx").on(t.questionId, t.createdAt),
  index("comments_parent_idx").on(t.parentCommentId),
  index("comments_user_idx").on(t.userId),
]);

export const commentReactions = pgTable("comment_reactions", {
  id: id(),
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reactionType: text("reaction_type").notNull(),
  createdAt: createdAt(),
}, (t) => [unique("comment_reactions_unique").on(t.commentId, t.userId, t.reactionType), check("reaction_type_allowed", sql`${t.reactionType} IN ('insightful')`)]);

export const userBlocks = pgTable("user_blocks", {
  blockerId: uuid("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]);

export const hiddenComments = pgTable("hidden_comments", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.commentId] })]);

// ───────────── Moderation ─────────────

export const contentReports = pgTable("content_reports", {
  id: id(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
  targetType: reportTargetEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").notNull().default("open"),
  assignedModeratorId: uuid("assigned_moderator_id").references(() => users.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
}, (t) => [index("content_reports_status_created_idx").on(t.status, t.createdAt), index("content_reports_target_idx").on(t.targetType, t.targetId)]);

export const moderationActions = pgTable("moderation_actions", {
  id: id(),
  moderatorId: uuid("moderator_id").references(() => users.id, { onDelete: "set null" }),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  reportId: uuid("report_id").references(() => contentReports.id, { onDelete: "set null" }),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "set null" }),
  action: moderationActionEnum("action").notNull(),
  reason: text("reason").notNull(),
  expiresAt: ts("expires_at"),
  createdAt: createdAt(),
}, (t) => [index("moderation_actions_target_idx").on(t.targetUserId, t.createdAt)]);

export const appeals = pgTable("appeals", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moderationActionId: uuid("moderation_action_id").notNull().references(() => moderationActions.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: appealStatusEnum("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
}, (t) => [unique("appeals_one_per_action").on(t.moderationActionId), index("appeals_status_idx").on(t.status, t.createdAt)]);

// ───────────── Ingestion ─────────────

/** Leads found by connectors or entered by editors. Metadata only — no article bodies. */
export const candidateStories = pgTable("candidate_stories", {
  id: id(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  normalizedUrl: text("normalized_url").notNull().unique(),
  publisherName: text("publisher_name"),
  summary: text("summary"),
  feedName: text("feed_name"),
  publishedAt: ts("published_at"),
  status: candidateStatusEnum("status").notNull().default("new"),
  duplicateOf: uuid("duplicate_of"),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("candidate_status_idx").on(t.status, t.createdAt)]);

// ───────────── Audit, analytics, limits ─────────────

export const editorialAuditLog = pgTable("editorial_audit_log", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  createdAt: createdAt(),
}, (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)]);

/**
 * Privacy-minimized product events. No response values, no free text, no IPs.
 * `subject` is a salted hash of the user or visitor id, not the id itself.
 */
export const analyticsEvents = pgTable("analytics_events", {
  id: id(),
  name: text("name").notNull(),
  subject: text("subject"),
  storyId: uuid("story_id"),
  props: jsonb("props").$type<Record<string, string | number | boolean>>(),
  createdAt: createdAt(),
}, (t) => [index("analytics_name_created_idx").on(t.name, t.createdAt), index("analytics_subject_idx").on(t.subject, t.createdAt)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").notNull(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.key, t.windowStart] })]);

export const aiUsage = pgTable("ai_usage", {
  day: text("day").primaryKey(),
  requests: integer("requests").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
});

export const errorEvents = pgTable("error_events", {
  id: id(),
  message: text("message").notNull(),
  digest: text("digest"),
  path: text("path"),
  stack: text("stack"),
  createdAt: createdAt(),
}, (t) => [index("error_events_created_idx").on(t.createdAt)]);

// ───────────── Notifications & email ─────────────

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  /** Dedupe key so the same event never notifies twice. */
  dedupeKey: text("dedupe_key"),
  readAt: ts("read_at"),
  emailedAt: ts("emailed_at"),
  createdAt: createdAt(),
}, (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt), uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey)]);

export const emailOutbox = pgTable("email_outbox", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull(),
  status: emailStatusEnum("status").notNull().default("pending"),
  error: text("error"),
  sentAt: ts("sent_at"),
  createdAt: createdAt(),
}, (t) => [index("email_outbox_status_idx").on(t.status, t.createdAt)]);
