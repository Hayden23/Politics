# Database schema

PostgreSQL 16, UUID primary keys, `timestamptz` everywhere. Source of truth: `src/server/db/schema.ts`; migrations in `drizzle/` (`0000_init.sql` tables/indexes, `0001_integrity_triggers.sql` triggers). Generate new migrations with `npm run db:generate` after editing the schema; never edit applied migrations.

## Spec tables (§6)

| Table | Notes / deviations |
|---|---|
| `users` | Spec columns plus `restricted_until`, `onboarded_at`. `role` and `account_status` are Postgres enums. Case-insensitive unique email index. Never hard-deleted (tombstoned on account deletion). |
| `user_preferences` | JSONB: `topic_preferences` (slugs), `notification_preferences {frequency}`, `privacy_preferences {showRatingOnComments, includeInDemographicAggregates}` |
| `user_demographics` | Separate table; stored only with consent. No birth dates, no precise location. |
| `topics` | Seeded with the 10 categories from the spec. |
| `stories` | Spec columns plus `editorial_priority` (editor-set feed weight; never derived from opinions). Trigger: cannot be `published` without `approved_by`. |
| `story_versions` | Spec columns plus `correction_note` (public) and `published_at`. Trigger: a published version's content and approval can't change. |
| `sources` | Spec columns plus `link_status` / `link_checked_at` for automated link monitoring. |
| `story_sources` | As spec; links are copied forward when a new version is created. |
| `questions` | As spec. `question_type` enum currently `seven_point_scale`; `scale_config` JSONB holds labels, uncertain option and grouping flag so other formats can be added. Trigger: published questions are immutable. |
| `ratings` | As spec; `UNIQUE(user_id, question_id)` (mandatory); CHECK that scale responses are 1–7 and uncertain responses have NULL value. |
| `rating_history` | As spec; the initial answer is recorded too (previous = NULL). |
| `comments` | Spec columns plus `edited_at`. `status`: active / removed (moderator) / deleted (author). |
| `comment_reactions` | CHECK limits reaction types to `insightful`. |
| `bookmarks`, `content_reports`, `consent_records` | As spec. `content_reports.target_type` enum: comment, story, user. |
| `editorial_audit_log` | As spec. Trigger makes it append-only. |

## Additional tables

| Table | Why |
|---|---|
| `user_credentials` | Password hashes kept out of the profile row. |
| `sessions` | Server-side sessions keyed by SHA-256 of the cookie token. |
| `user_blocks`, `hidden_comments` | Block and hide controls (§9.2). |
| `moderation_actions`, `appeals` | Enforcement history and appeals (§4 Screen 12). |
| `candidate_stories` | Ingestion leads (metadata only, never article bodies). |
| `analytics_events` | Privacy-minimized product events. |
| `rate_limits` | Fixed-window counters shared by all app instances. |
| `ai_usage` | Daily AI request/token counts for the cost ceiling. |
| `error_events` | Server errors for the admin dashboard. |

## Required indexes (§6.18)

All present: `stories(status, published_at)`, `questions(story_id, status)`, `ratings(question_id, response_value)`, `ratings(user_id, question_id)` (plus the unique constraint), `comments(question_id, created_at)`, `comments(parent_comment_id)`, `sources(publisher_name)`, `content_reports(status, created_at)`.

## Deletion rules

User-owned rows cascade on user deletion, but the app never hard-deletes users; see `deleteAccount` in `src/server/services/identity.ts` for exactly what is deleted vs de-identified. Stories cascade to versions, questions, links, comments and bookmarks (stories are archived, not deleted, in normal operation).

## v2 additions (`0002`, `0003`)

| Change | Purpose |
|---|---|
| `publishers` (name, domain, `lean` enum, `lean_basis`, notes) + `sources.publisher_id` | Outlet registry and coverage balance |
| `stories.perspectives`, `story_versions.perspectives` (JSONB) | Left/right perspectives, versioned; immutability trigger updated |
| `story_versions.balance_check` (JSONB) | Last heuristic/AI balance review of the working version |
| `stories.scheduled_publish_at`, `scheduled_by` | Scheduled publishing |
| `notifications` (unique `(user_id, dedupe_key)`) | In-app notifications |
| `email_outbox` | Digest queue and delivery status |
