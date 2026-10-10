# Architecture

A **modular monolith**: one Next.js application (App Router, React 19, TypeScript) backed by PostgreSQL, plus one background worker process sharing the same code. No microservices.

```
Browser ──► Next.js (pages = server components, REST route handlers)
              │
              ├─ src/server/services/*   business logic (only place that writes data)
              ├─ src/domain/*            pure rules: scale validation, aggregation, workflow state machine
              ├─ src/server/ai/*         provider-agnostic drafting (Anthropic or test mock)
              └─ src/server/db/*         Drizzle schema + client ──► PostgreSQL
Worker (scripts/worker.ts) ── ingestion, link checks, restriction expiry, retention purges
```

Pages render on the server and call services directly; interactive client components call the REST endpoints in `src/app/api/**`, which are thin wrappers (`route()` in `src/lib/api.ts`) that authenticate, validate with zod, rate-limit and call the same services. Every rule below is enforced in services (and some in the database), never only in the UI.

## Modules (spec §3.3)

| Module | Code |
|---|---|
| Authentication & authorization | `server/auth/*` (sessions, roles, Google OIDC), `lib/api.ts` (CSRF origin check) |
| Profiles & consent | `services/identity.ts` (signup, onboarding, preferences, demographics, consent records, export, deletion) |
| News ingestion | `services/ingestion.ts` (RSS connector, dedupe, candidates, link monitoring) |
| Editorial workflow | `services/editorial.ts`, `domain/storyWorkflow.ts`, `server/ai/*` |
| Stories & sources | `services/reader.ts` (feed, source-blind briefing, gated results/sources) |
| Questions & ratings | `services/ratings.ts`, `domain/scale.ts` |
| Poll aggregation | `domain/aggregation.ts`, `reader.questionDistribution`, `explore.questionTrend` |
| Community | `services/community.ts` |
| Moderation | `services/moderation.ts` |
| Opinion history | `ratings.myRatings` |
| Geographic/demographic analytics | P1 — schema and threshold helper (`meetsThreshold`, `STATE_RESULTS_THRESHOLD`) exist; no UI yet |
| Notifications | P1 — preferences stored; no delivery yet |
| Product analytics & audit | `services/analytics.ts`, `services/audit.ts`, `services/admin.ts`, `services/errors.ts` |

## How the key rules are enforced

| Rule (spec §7) | Enforcement |
|---|---|
| Drafts never visible to users | `reader.loadVisibleStory` 404s anything not `published` unless an editor asks for `preview` |
| AI can't bypass approval | AI output is stored in `story_versions.ai_draft` only; editors copy fields manually. `publishStory` requires an approver on both the story and the version; a DB trigger rejects `status='published'` with `approved_by IS NULL` |
| Edits invalidate approval | `updateStory` / `setQuestion` return the story to `draft` and clear approval |
| Atomic, duplicate-safe initial rating | `UNIQUE(user_id, question_id)` + `INSERT … ON CONFLICT DO NOTHING` in a transaction; repeat of the same answer is idempotent, a different answer is a 409 |
| Changes create history | `updateRating` locks the row (`SELECT … FOR UPDATE`) and writes `rating_history`; the initial answer is also a history row so it's always recoverable |
| Results from valid DB responses | `GROUP BY response_type, response_value`; integer counts → percentages on the server; no forced-to-100 rounding |
| Uncertainty separate | `response_type='uncertain'`, `response_value NULL` (CHECK constraint); excluded from the valid base |
| Private ratings | No endpoint takes a user id; `/api/me/*` only uses the session. Comment author ratings appear only if the author opts in; the "different responses" filter only matches opted-in authors |
| Source reveal server-side | `/api/stories/:ref` omits publisher fields; results/sources/discussion require a rating on that story |
| Immutable question versions | Published questions can't change (DB trigger); revisions create version N+1 and retire N. Results are reported per version |
| Audited privileged actions | `editorial_audit_log` written in the same transaction as each editorial/moderation action; append-only trigger |

## Security

Server-side zod validation on every input; role checks in services; HTTP-only `SameSite=Lax` session cookies storing only a SHA-256 of the token; same-origin check on all mutating API requests; Postgres-backed rate limits for login, signup, rating, commenting, reactions, reporting and AI drafting; scrypt password hashes in a separate table; CSP and security headers (`next.config.ts`); parameterized queries via Drizzle; React escaping for all user content; outbound source links use `rel="noopener noreferrer nofollow"` and must be public `https://` URLs. Suspension deletes all sessions immediately; role changes force re-login.

## Privacy model

- Ratings are never public. Analytics events never contain response values; event subjects are salted hashes, retained `ANALYTICS_RETENTION_DAYS`.
- Demographics live in `user_demographics`, stored only with explicit consent (a `consent_records` row is written either way). Never joined into public queries.
- Export: `GET /api/me/export` returns everything held about the user.
- Deletion: ratings, history, demographics, preferences, credentials, sessions, bookmarks, reactions, blocks and appeals are deleted; comments are blanked to `[deleted]`; the user row becomes a de-identified tombstone so editorial FK references remain valid.
