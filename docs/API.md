# API reference

JSON over HTTPS. Auth is the `cl_session` HTTP-only cookie. Mutating requests must be same-origin (Origin header checked). Errors: `{ "error": string, "code"?: string }` with 400 invalid input, 401 not signed in, 403 forbidden / not yet rated, 404 not found (including unpublished stories), 409 conflict (`already_rated`, `version_mismatch`, `invalid_transition`, `use_correction`…), 429 rate limited.

## Auth & account
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | `{email, password(≥10), displayName, acceptTerms:true}` → session |
| POST | `/api/auth/login` | `{email, password}` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/oauth/google?next=` | Google sign-in (if configured) |
| POST | `/api/onboarding` | `{topics[], demographicsConsent, demographics?}` |
| GET/PATCH | `/api/me/settings` | display name, topics, notification frequency, `showRatingOnComments` |
| PUT | `/api/me/demographics` | `{consent, demographics}`; `consent:false` deletes them |
| GET | `/api/me/ratings?topic=` | caller's own ratings with original/current/history |
| GET/POST | `/api/me/bookmarks` | POST `{storyId}` |
| DELETE | `/api/me/bookmarks/:storyId` | |
| GET | `/api/me/export` | JSON download of all personal data |
| DELETE | `/api/me/account` | `{confirm:"DELETE"}` |
| GET/POST | `/api/me/notifications` | list + unread count; POST `{ids?}` marks read |
| GET | `/api/me/summary` | private weekly summary |
| POST | `/api/me/appeals` | `{moderationActionId, body}` |
| POST | `/api/appeals/suspension` | `{email, password, body}` for suspended accounts |

## Reading & rating
| Method | Path | Notes |
|---|---|---|
| GET | `/api/topics` | |
| GET | `/api/stories?topic=&offset=&limit=&answered=` | published only; no publisher data |
| GET | `/api/stories/:slugOrId` | source-blind briefing + current question + caller's rating |
| GET | `/api/stories/:slugOrId/results` | **403 until the caller has rated**; per question version: counts, percentages, uncertain count, grouping, median, date range, population, weighting |
| GET | `/api/stories/:slugOrId/sources` | **403 until rated**; sources + correction notes |
| POST | `/api/questions/:id/ratings` | `{questionVersion, response:{type:"scale",value:1-7}|{type:"uncertain"}}` → `{created}`; idempotent for the same answer, 409 for a different one |
| PATCH | `/api/questions/:id/ratings` | `{response}` → `{changed}`; writes history |
| GET | `/api/stories/:slugOrId/perspectives` | **403 until rated**; left/right perspectives with resolved citations |
| GET | `/api/stories/:slugOrId/breakdowns` | **403 until rated**; ideology, state, age, area breakdowns (threshold-suppressed) and opinion change |
| GET | `/api/explore?topic=&sort=popular|recent` | distributions only for questions the caller answered |

## Community & reports
| Method | Path | Notes |
|---|---|---|
| GET | `/api/questions/:id/comments?perspective=all|different|insightful|newest` | 403 until rated |
| POST | `/api/questions/:id/comments` | `{body}` (10–2000 chars); requires rating; restricted accounts refused |
| POST | `/api/comments/:id/replies` | `{body}`; threads are one level deep |
| PATCH/DELETE | `/api/comments/:id` | own comments; edits within 24 h |
| POST | `/api/comments/:id/reactions` | toggles "insightful" |
| POST | `/api/comments/:id/hide` | hide for me |
| POST/DELETE | `/api/users/:id/block` | |
| POST | `/api/reports` | `{targetType: comment|story|user, targetId, reason, details?}` |
| POST | `/api/events` | client analytics allowlist: `story_shared`, `perspective_explored` |

## Newsroom (editor/admin unless noted)
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/admin/stories` | list by `?status=`; create draft |
| GET/PATCH | `/api/admin/stories/:id` | full editor payload; edit (unpublished only) |
| POST | `/api/admin/stories/:id/question` | set draft question / create new version |
| POST | `/api/admin/stories/:id/sources` · DELETE `…/sources/:sourceId` | |
| POST | `/api/admin/stories/:id/generate-draft` | `{editorNotes, material[]}` → unapproved AI draft |
| POST | `/api/admin/stories/:id/submit-review` · `approve` · `request-changes` · `publish` · `correct` · `unpublish` · `archive` · `restore` | state machine in `domain/storyWorkflow.ts` |
| POST | `/api/admin/stories/:id/balance-check` | `{ai}` heuristic (+ optional AI) balance review |
| POST | `/api/admin/stories/:id/schedule` | `{at: ISO|null}` approved stories only |
| GET/POST | `/api/admin/publishers` · PATCH `…/:id` | outlet registry; lean requires `leanBasis` |
| GET | `/api/admin/clusters` · POST `/api/admin/clusters/promote` | `{candidateIds}` |
| GET/POST | `/api/admin/candidates` · POST `…/:id/promote` · `…/:id/dismiss` | |
| GET | `/api/admin/reports?status=` | moderators (all), editors (story reports) |
| POST | `/api/admin/reports/:id/resolve` | `{action, reason, restrictDays?}` |
| GET | `/api/admin/appeals` · POST `…/:id/resolve` | moderators; `{decision: upheld|overturned, resolution}` |
| POST | `/api/admin/users/:id/role` | admin only |
| GET | `/api/health` | DB liveness |
