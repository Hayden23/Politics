# Decisions, substitutions and open items

## Technology choices (spec §3.1)

| Spec | Chosen | Impact |
|---|---|---|
| Next.js, React, TypeScript, Tailwind | Next.js 16, React 19, TS 5.9, Tailwind 4 | as specified |
| PostgreSQL + Prisma or Drizzle | PostgreSQL 16 + Drizzle ORM / drizzle-kit migrations | SQL-level control for triggers and atomic upserts |
| Managed auth provider | **Substitution:** first-party auth (scrypt passwords + server-side sessions) with optional Google OpenID Connect, chosen at kickoff | No vendor account needed; we own password storage and must keep the auth code reviewed. Swappable: `server/auth/session.ts` is the only seam |
| Provider-agnostic AI service | `server/ai` interface; Anthropic Claude implementation (`AI_MODEL`, default `claude-opus-5-5`, server-side refusal fallback enabled); deterministic mock for tests only | Without an API key the AI button returns "not configured" and editors write by hand |
| Managed queue / scheduled worker | Single worker process with interval jobs (`scripts/worker.ts`) or cron `--once` | Enough for MVP volumes; move to a managed queue if jobs grow |
| Privacy-conscious analytics | **Substitution:** first-party `analytics_events` table with allowlisted events/props and hashed subjects; metrics in Newsroom → Metrics | No third-party tracker; dashboards are basic |
| Managed error monitoring | **Substitution:** `onRequestError` instrumentation → structured logs + `error_events` table + optional webhook | Add Sentry or similar later by extending `reportError` |
| Playwright | `@playwright/test`, E2E tests A–E | |

## Product decisions made during implementation

- **Results gate covers the whole story.** Rating any version of a story's question unlocks its results, sources and discussion; if the question was revised, the user is asked to answer the new wording too.
- **Explore never shows a distribution for a question you haven't answered.** Explore lists all questions with participation counts but shows results only for answered ones, so it can't be used to see results before rating.
- **A comment requires having rated.** Explanations are "the reason behind your position".
- **Comment author ratings are opt-in** (Profile → Privacy). The "Different responses" filter only matches opted-in authors, so it reveals nothing private.
- **Threads are one level deep**; replying to a reply joins the same thread.
- **Corrections** are applied by an editor (who is the approving human), create a new immutable version with a public note, and may create a new question version. Unpublished stories go back through review when edited.
- **Two-person approval** is available (`EDITORIAL_TWO_PERSON_RULE=true`) but off by default for small teams.
- **Account deletion deletes ratings** (aggregates go down) rather than keeping de-identified votes; this is the more privacy-protective choice. Revisit with legal if historical counts must be preserved.
- **Small-sample warning** at fewer than 30 valid responses (`SMALL_SAMPLE_THRESHOLD`). State threshold 100 (`STATE_RESULTS_THRESHOLD`) is configured for P1.
- **Notification preferences** are stored; no notifications are sent in P0.
- **Working name** "Civic Lens" lives in `src/lib/brand.ts` / `NEXT_PUBLIC_APP_NAME`.

## Open items before launch (spec §14 handoff)

- Confirm legally permissible content sources and feed list (`INGEST_FEEDS`); the connector stores headline/link/summary metadata only.
- Confirm AI provider budget (`AI_DAILY_REQUEST_LIMIT`).
- Legal review of the privacy policy, terms and guidelines pages (marked as drafts in the app).
- Product/design review of the UI; formal WCAG 2.2 AA audit with assistive tech.
- Deploy staging and run the restore drill in `DEPLOY.md`.

## v2 decisions

- **Left/right is shown two ways, both after rating:** editor-written perspectives (what each side argues) and opt-in results by self-identified ideology (what participants on each side answered). Neither appears before a reader forms their own view.
- **Perspectives must be symmetric** (both or neither) and the balance check flags length/argument asymmetry.
- **Outlet lean ratings require a stated basis** and none are bundled; the team must license or document them before launch.
- **Ideology breakdowns default to a 100-response threshold per group** (same as states) because political self-ID is sensitive; suppressed groups hide their counts too. Only users with demographic consent are counted (`consent_at`), so the separate `includeInDemographicAggregates` preference is unused.
- **No partisan colors** anywhere, including left/right panels.
- **Email:** Resend via HTTP when configured; otherwise digests are logged and marked `skipped`. Digests are sent at `DIGEST_HOUR_UTC`, weekly ones on Mondays.
- **Scheduled publishing** runs as the editor who scheduled it and is cancelled if they lose editorial rights before it fires.
