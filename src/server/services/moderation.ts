import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/server/db";
import { appeals, comments, contentReports, moderationActions, sessions, stories, users } from "@/server/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { type Actor, isEditor, isModerator } from "@/server/auth/roles";
import { audit } from "./audit";
import { notify } from "./notifications";

export const COMMENT_REPORT_REASONS = ["spam", "harassment", "hate", "threat_or_violence", "personal_information", "impersonation", "other"] as const;
export const STORY_REPORT_REASONS = ["factual_error", "missing_context", "framing_concern", "broken_link", "source_identity_leak", "other"] as const;

export const reportSchema = z.object({
  targetType: z.enum(["comment", "story", "user"]),
  targetId: z.string().uuid(),
  reason: z.enum([...COMMENT_REPORT_REASONS, ...STORY_REPORT_REASONS]),
  details: z.string().trim().max(1000).optional(),
});

export const resolveSchema = z.object({
  action: z.enum(["dismiss", "remove_content", "warn", "restrict", "suspend", "escalate", "resolve_editorial"]),
  reason: z.string().trim().min(5, "Record a reason").max(1000),
  restrictDays: z.number().int().min(1).max(365).optional(),
});

export async function createReport(actor: Actor, input: z.infer<typeof reportSchema>) {
  const storyReason = (STORY_REPORT_REASONS as readonly string[]).includes(input.reason);
  if (input.targetType === "story" && !storyReason) throw badRequest("Choose a reason that fits a story");
  if (input.targetType !== "story" && storyReason && input.reason !== "other") throw badRequest("Choose a reason that fits a comment");
  if (input.targetType === "comment") {
    const [c] = await db.select().from(comments).where(eq(comments.id, input.targetId));
    if (!c || c.status !== "active") throw notFound("Comment not found");
    if (c.userId === actor.id) throw badRequest("You can't report your own comment");
  } else if (input.targetType === "story") {
    const [s] = await db.select({ status: stories.status }).from(stories).where(eq(stories.id, input.targetId));
    if (!s || s.status !== "published") throw notFound("Story not found");
  } else {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.targetId));
    if (!u || u.id === actor.id) throw notFound("User not found");
  }
  const [existing] = await db
    .select()
    .from(contentReports)
    .where(and(eq(contentReports.reporterId, actor.id), eq(contentReports.targetId, input.targetId), inArray(contentReports.status, ["open", "escalated"])));
  if (existing) return existing;
  const [r] = await db.insert(contentReports).values({ reporterId: actor.id, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details ?? null }).returning();
  return r;
}

function canHandle(actor: Actor, targetType: "comment" | "story" | "user") {
  return targetType === "story" ? isEditor(actor) || isModerator(actor) : isModerator(actor);
}

export async function listReports(actor: Actor, status: "open" | "escalated" | "resolved" | "dismissed" = "open") {
  if (!isModerator(actor) && !isEditor(actor)) throw forbidden();
  const types = isModerator(actor) ? (["comment", "story", "user"] as const) : (["story"] as const);
  const rows = await db
    .select()
    .from(contentReports)
    .where(and(eq(contentReports.status, status), inArray(contentReports.targetType, [...types])))
    .orderBy(status === "open" || status === "escalated" ? asc(contentReports.createdAt) : desc(contentReports.resolvedAt))
    .limit(200);
  return Promise.all(rows.map(async (r) => ({ ...r, context: await reportContext(r) })));
}

/** Everything a moderator needs to judge a report in context. */
async function reportContext(r: typeof contentReports.$inferSelect) {
  if (r.targetType === "comment") {
    const [c] = await db.select({ c: comments, author: users.displayName, authorId: users.id, authorStatus: users.accountStatus }).from(comments).innerJoin(users, eq(users.id, comments.userId)).where(eq(comments.id, r.targetId));
    if (!c) return { missing: true as const };
    const [story] = await db.select({ headline: stories.headline, slug: stories.slug }).from(stories).where(eq(stories.id, c.c.storyId));
    const parent = c.c.parentCommentId ? (await db.select({ body: comments.body, status: comments.status }).from(comments).where(eq(comments.id, c.c.parentCommentId)))[0] : null;
    const replies = await db.select({ id: comments.id, body: comments.body, status: comments.status }).from(comments).where(eq(comments.parentCommentId, c.c.id)).orderBy(asc(comments.createdAt)).limit(10);
    return {
      kind: "comment" as const,
      body: c.c.body,
      status: c.c.status,
      createdAt: c.c.createdAt.toISOString(),
      author: { id: c.authorId, name: c.author, status: c.authorStatus },
      authorHistory: await userHistory(c.authorId),
      story,
      parent,
      replies,
      otherOpenReports: await countOpen(r.targetId),
    };
  }
  if (r.targetType === "story") {
    const [s] = await db.select({ id: stories.id, headline: stories.headline, slug: stories.slug, status: stories.status }).from(stories).where(eq(stories.id, r.targetId));
    return s ? { kind: "story" as const, ...s, otherOpenReports: await countOpen(r.targetId) } : { missing: true as const };
  }
  const [u] = await db.select({ id: users.id, name: users.displayName, status: users.accountStatus }).from(users).where(eq(users.id, r.targetId));
  return u ? { kind: "user" as const, ...u, authorHistory: await userHistory(u.id), otherOpenReports: await countOpen(r.targetId) } : { missing: true as const };
}

async function countOpen(targetId: string) {
  const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(contentReports).where(and(eq(contentReports.targetId, targetId), eq(contentReports.status, "open")));
  return n?.n ?? 0;
}

export async function userHistory(userId: string) {
  const actions = await db.select({ action: moderationActions.action, reason: moderationActions.reason, createdAt: moderationActions.createdAt }).from(moderationActions).where(eq(moderationActions.targetUserId, userId)).orderBy(desc(moderationActions.createdAt)).limit(20);
  const [removed] = await db.select({ n: sql<number>`count(*)::int` }).from(comments).where(and(eq(comments.userId, userId), eq(comments.status, "removed")));
  return { actions, removedComments: removed?.n ?? 0 };
}

async function targetUserFor(tx: Tx, r: typeof contentReports.$inferSelect): Promise<string | null> {
  if (r.targetType === "user") return r.targetId;
  if (r.targetType === "comment") {
    const [c] = await tx.select({ userId: comments.userId }).from(comments).where(eq(comments.id, r.targetId));
    return c?.userId ?? null;
  }
  return null;
}

export async function resolveReport(actor: Actor, reportId: string, input: z.infer<typeof resolveSchema>) {
  const result = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(contentReports).where(eq(contentReports.id, reportId)).for("update");
    if (!r) throw notFound("Report not found");
    if (!canHandle(actor, r.targetType)) throw forbidden("Moderator access required");
    if (r.status === "resolved" || r.status === "dismissed") throw conflict("This report is already closed", "closed");
    if (r.targetType === "story" && !["dismiss", "escalate", "resolve_editorial"].includes(input.action)) throw badRequest("Story reports are handled by editors: correct the story, then resolve the report");
    if (r.targetType !== "story" && input.action === "resolve_editorial") throw badRequest("That action only applies to story reports");

    const targetUserId = await targetUserFor(tx, r);
    if (targetUserId) {
      const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, targetUserId));
      if (targetUserId === actor.id) throw forbidden("You can't moderate your own content");
      if (target?.role === "admin" && actor.role !== "admin" && ["restrict", "suspend"].includes(input.action)) throw forbidden("Escalate reports about administrators");
    }

    const now = new Date();
    let actionName: (typeof moderationActions.$inferInsert)["action"] = "dismiss_report";
    let expiresAt: Date | null = null;
    switch (input.action) {
      case "dismiss":
        break;
      case "escalate":
        actionName = "escalate";
        break;
      case "resolve_editorial":
        actionName = "dismiss_report";
        break;
      case "remove_content":
        if (r.targetType !== "comment") throw badRequest("Only comments can be removed");
        actionName = "remove_content";
        await tx.update(comments).set({ status: "removed", updatedAt: now }).where(eq(comments.id, r.targetId));
        break;
      case "warn":
        actionName = "warn";
        break;
      case "restrict":
        actionName = "restrict";
        expiresAt = new Date(now.getTime() + (input.restrictDays ?? 7) * 86400_000);
        if (!targetUserId) throw badRequest("No account to restrict");
        await tx.update(users).set({ accountStatus: "restricted", restrictedUntil: expiresAt, updatedAt: now }).where(and(eq(users.id, targetUserId), ne(users.accountStatus, "deleted")));
        break;
      case "suspend":
        actionName = "suspend";
        if (!targetUserId) throw badRequest("No account to suspend");
        await tx.update(users).set({ accountStatus: "suspended", updatedAt: now }).where(and(eq(users.id, targetUserId), ne(users.accountStatus, "deleted")));
        await tx.delete(sessions).where(eq(sessions.userId, targetUserId));
        // Suspensions also remove the reported comment.
        if (r.targetType === "comment") await tx.update(comments).set({ status: "removed", updatedAt: now }).where(eq(comments.id, r.targetId));
        break;
    }

    const [ma] = await tx
      .insert(moderationActions)
      .values({ moderatorId: actor.id, targetUserId: ["warn", "restrict", "suspend", "remove_content"].includes(input.action) ? targetUserId : null, reportId: r.id, commentId: r.targetType === "comment" ? r.targetId : null, action: actionName, reason: input.reason, expiresAt })
      .returning();

    const status = input.action === "escalate" ? "escalated" : input.action === "dismiss" ? "dismissed" : "resolved";
    const resolution = `${input.action}: ${input.reason}`;
    await tx
      .update(contentReports)
      .set({ status, resolution, assignedModeratorId: actor.id, resolvedAt: status === "escalated" ? null : now })
      .where(eq(contentReports.id, r.id));
    // Content removal settles every other open report about the same item.
    if (["remove_content", "suspend"].includes(input.action)) {
      await tx
        .update(contentReports)
        .set({ status: "resolved", resolution: `Resolved with report ${r.id}`, assignedModeratorId: actor.id, resolvedAt: now })
        .where(and(eq(contentReports.targetId, r.targetId), inArray(contentReports.status, ["open", "escalated"]), ne(contentReports.id, r.id)));
    }
    await audit(tx, actor.id, `moderation.${input.action}`, r.targetType, r.targetId, { reportStatus: r.status }, { reportId: r.id, status, moderationActionId: ma.id });
    return { report: { ...r, status, resolution }, action: ma };
  });
  const ma = result.action;
  if (ma.targetUserId && ["remove_content", "warn", "restrict", "suspend"].includes(ma.action)) {
    const titles: Record<string, string> = {
      remove_content: "A moderator removed one of your comments",
      warn: "You received a warning from a moderator",
      restrict: "Your commenting is temporarily restricted",
      suspend: "Your account was suspended",
    };
    await notify(db, ma.targetUserId, { kind: "moderation", title: titles[ma.action], body: `Reason: ${ma.reason}. You can appeal from your profile.`, link: "/profile#standing", dedupeKey: `mod:${ma.id}` }).catch(() => {});
  }
  return result;
}

// ───────────── Appeals ─────────────

export const APPEALABLE = ["remove_content", "warn", "restrict", "suspend"] as const;

export async function myEnforcement(actor: Actor) {
  const rows = await db
    .select({ a: moderationActions, appeal: appeals })
    .from(moderationActions)
    .leftJoin(appeals, eq(appeals.moderationActionId, moderationActions.id))
    .where(and(eq(moderationActions.targetUserId, actor.id), inArray(moderationActions.action, [...APPEALABLE])))
    .orderBy(desc(moderationActions.createdAt));
  return rows.map(({ a, appeal }) => ({
    id: a.id,
    action: a.action,
    reason: a.reason,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    appeal: appeal && { status: appeal.status, resolution: appeal.resolution, createdAt: appeal.createdAt.toISOString() },
  }));
}

export async function fileAppeal(userId: string, moderationActionId: string, body: string) {
  const [a] = await db.select().from(moderationActions).where(eq(moderationActions.id, moderationActionId));
  if (!a || a.targetUserId !== userId || !(APPEALABLE as readonly string[]).includes(a.action)) throw notFound("Enforcement action not found");
  const [existing] = await db.select().from(appeals).where(eq(appeals.moderationActionId, moderationActionId));
  if (existing) throw conflict("You've already appealed this decision", "already_appealed");
  const [ap] = await db.insert(appeals).values({ userId, moderationActionId, body: body.trim().slice(0, 2000) }).returning();
  return ap;
}

/** Suspended users can't sign in, so they appeal their latest suspension with their credentials. */
export async function latestSuspension(userId: string) {
  const [a] = await db.select().from(moderationActions).where(and(eq(moderationActions.targetUserId, userId), eq(moderationActions.action, "suspend"))).orderBy(desc(moderationActions.createdAt)).limit(1);
  return a ?? null;
}

export async function listAppeals(actor: Actor, status: "open" | "upheld" | "overturned" = "open") {
  if (!isModerator(actor)) throw forbidden("Moderator access required");
  return db
    .select({ appeal: appeals, action: moderationActions, userName: users.displayName })
    .from(appeals)
    .innerJoin(moderationActions, eq(moderationActions.id, appeals.moderationActionId))
    .innerJoin(users, eq(users.id, appeals.userId))
    .where(eq(appeals.status, status))
    .orderBy(asc(appeals.createdAt));
}

export async function resolveAppeal(actor: Actor, appealId: string, decision: "upheld" | "overturned", resolution: string) {
  if (!isModerator(actor)) throw forbidden("Moderator access required");
  return db.transaction(async (tx) => {
    const [ap] = await tx.select().from(appeals).where(eq(appeals.id, appealId)).for("update");
    if (!ap) throw notFound("Appeal not found");
    if (ap.status !== "open") throw conflict("This appeal is already decided", "closed");
    const [a] = await tx.select().from(moderationActions).where(eq(moderationActions.id, ap.moderationActionId));
    // Whoever made the decision shouldn't be the only one to review it, unless they're an admin.
    if (a.moderatorId === actor.id && actor.role !== "admin") throw forbidden("Another moderator must review appeals of your decisions");
    const now = new Date();
    if (decision === "overturned") {
      if (a.action === "suspend" || a.action === "restrict") {
        await tx.update(users).set({ accountStatus: "active", restrictedUntil: null, updatedAt: now }).where(and(eq(users.id, ap.userId), ne(users.accountStatus, "deleted")));
        await tx.insert(moderationActions).values({ moderatorId: actor.id, targetUserId: ap.userId, action: "reinstate", reason: `Appeal overturned: ${resolution}` });
      }
      if (a.commentId && (a.action === "remove_content" || a.action === "suspend")) {
        await tx.update(comments).set({ status: "active", updatedAt: now }).where(and(eq(comments.id, a.commentId), eq(comments.status, "removed")));
        await tx.insert(moderationActions).values({ moderatorId: actor.id, targetUserId: ap.userId, commentId: a.commentId, action: "restore_content", reason: `Appeal overturned: ${resolution}` });
      }
    }
    await tx.update(appeals).set({ status: decision, resolution, resolvedBy: actor.id, resolvedAt: now }).where(eq(appeals.id, ap.id));
    await audit(tx, actor.id, `appeal.${decision}`, "appeal", ap.id, { status: "open" }, { status: decision, moderationActionId: a.id });
    await notify(tx, ap.userId, { kind: "appeal", title: decision === "overturned" ? "Your appeal was successful" : "Your appeal was reviewed", body: resolution, link: "/profile#standing", dedupeKey: `appeal:${ap.id}` });
  });
}

/** Lapsed restrictions return to active (run by the worker; also checked at post time). */
export async function liftExpiredRestrictions() {
  await db.update(users).set({ accountStatus: "active", restrictedUntil: null }).where(and(eq(users.accountStatus, "restricted"), sql`${users.restrictedUntil} < now()`));
}
