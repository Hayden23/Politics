import { desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { analyticsEvents, editorialAuditLog, errorEvents, sessions, stories, users } from "@/server/db/schema";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { type Actor, type Role, isAdmin, isStaff } from "@/server/auth/roles";
import { audit } from "./audit";

export async function searchUsers(actor: Actor, q: string) {
  if (!isAdmin(actor)) throw forbidden("Admin access required");
  const like = `%${q.trim()}%`;
  return db
    .select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, accountStatus: users.accountStatus, createdAt: users.createdAt })
    .from(users)
    .where(q.trim() ? or(ilike(users.email, like), ilike(users.displayName, like)) : sql`${users.role} <> 'user'`)
    .orderBy(desc(users.createdAt))
    .limit(50);
}

export async function setRole(actor: Actor, userId: string, role: Role) {
  if (!isAdmin(actor)) throw forbidden("Admin access required");
  if (userId === actor.id && role !== "admin") throw badRequest("You can't remove your own admin role");
  const [before] = await db.select().from(users).where(eq(users.id, userId));
  if (!before || before.accountStatus === "deleted") throw notFound("User not found");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  // Privilege changes take effect on next sign-in.
  if (before.role !== role) await db.delete(sessions).where(eq(sessions.userId, userId));
  await audit(db, actor.id, "user.role_change", "user", userId, { role: before.role }, { role });
}

export async function auditLog(actor: Actor, opts: { entityId?: string; limit?: number } = {}) {
  if (!isStaff(actor)) throw forbidden();
  return db
    .select({ log: editorialAuditLog, actorName: users.displayName })
    .from(editorialAuditLog)
    .leftJoin(users, eq(users.id, editorialAuditLog.actorId))
    .where(opts.entityId ? eq(editorialAuditLog.entityId, opts.entityId) : undefined)
    .orderBy(desc(editorialAuditLog.createdAt))
    .limit(Math.min(opts.limit ?? 200, 500));
}

/** Launch metrics computed from privacy-minimized events. */
export async function launchMetrics(actor: Actor, days = 30) {
  if (!isAdmin(actor) && !isStaff(actor)) throw forbidden();
  const since = new Date(Date.now() - days * 86400_000);
  const counts = await db
    .select({ name: analyticsEvents.name, n: sql<number>`count(*)::int`, subjects: sql<number>`count(DISTINCT ${analyticsEvents.subject})::int` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.name);
  const by = Object.fromEntries(counts.map((c) => [c.name, c]));
  const viewers = by.story_viewed?.subjects ?? 0;
  const raters = by.rating_submitted?.subjects ?? 0;
  const [second] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT subject FROM analytics_events WHERE name = 'rating_submitted' AND created_at >= ${since.toISOString()}
      GROUP BY subject HAVING count(*) >= 2) t`);
  const retention = await db.execute<{ d1: number; d7: number; d30: number; cohort: number }>(sql`
    WITH first_seen AS (
      SELECT subject, min(created_at) AS t0 FROM analytics_events WHERE subject IS NOT NULL GROUP BY subject
      HAVING min(created_at) >= ${since.toISOString()}
    )
    SELECT count(*)::int AS cohort,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events e WHERE e.subject = f.subject AND e.created_at >= f.t0 + interval '1 day' AND e.created_at < f.t0 + interval '2 days'))::int AS d1,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events e WHERE e.subject = f.subject AND e.created_at >= f.t0 + interval '7 days' AND e.created_at < f.t0 + interval '8 days'))::int AS d7,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events e WHERE e.subject = f.subject AND e.created_at >= f.t0 + interval '30 days' AND e.created_at < f.t0 + interval '31 days'))::int AS d30
    FROM first_seen f`);
  const [storyQuality] = await db.execute<{ published: number; corrected: number }>(sql`
    SELECT count(*) FILTER (WHERE status = 'published')::int AS published,
           count(*) FILTER (WHERE status = 'published' AND current_version > 1 AND EXISTS (
             SELECT 1 FROM story_versions v WHERE v.story_id = stories.id AND v.correction_note IS NOT NULL))::int AS corrected
    FROM stories`);
  const [brokenLinks] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM sources WHERE link_status = 'broken'`);
  const [errors] = await db.select({ n: sql<number>`count(*)::int` }).from(errorEvents).where(gte(errorEvents.createdAt, since));
  const rate = (a: number, b: number) => (b ? a / b : null);
  return {
    days,
    events: counts,
    firstRatingConversion: rate(raters, viewers),
    ratingsPerActiveRater: rate(by.rating_submitted?.n ?? 0, raters),
    secondStoryRate: rate(Number(second?.n ?? 0), raters),
    resultsViewRate: rate(by.results_viewed?.subjects ?? 0, raters),
    perspectiveRate: rate(by.perspective_explored?.subjects ?? 0, raters),
    sourceRevealRate: rate(by.source_revealed?.subjects ?? 0, raters),
    retention: retention[0] ?? null,
    correctionRate: rate(Number(storyQuality?.corrected ?? 0), Number(storyQuality?.published ?? 0)),
    brokenSourceLinks: Number(brokenLinks?.n ?? 0),
    serverErrors: errors?.n ?? 0,
  };
}

export async function recentErrors(actor: Actor) {
  if (!isAdmin(actor)) throw forbidden("Admin access required");
  return db.select().from(errorEvents).orderBy(desc(errorEvents.createdAt)).limit(100);
}

export async function dashboardCounts() {
  const rows = await db.select({ status: stories.status, n: sql<number>`count(*)::int` }).from(stories).groupBy(stories.status);
  const [openReports] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM content_reports WHERE status IN ('open','escalated')`);
  const [candidates] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM candidate_stories WHERE status = 'new'`);
  const [appealsOpen] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM appeals WHERE status = 'open'`);
  return {
    byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>,
    openReports: Number(openReports?.n ?? 0),
    newCandidates: Number(candidates?.n ?? 0),
    openAppeals: Number(appealsOpen?.n ?? 0),
  };
}

