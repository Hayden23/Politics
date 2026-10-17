import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Executor } from "@/server/db";
import { comments, emailOutbox, notifications, stories, topics, userBlocks, userPreferences, users } from "@/server/db/schema";
import type { Actor } from "@/server/auth/roles";
import { sendEmail } from "./email";
import { weeklySummary } from "./summary";

type Kind = (typeof notifications.$inferInsert)["kind"];

export async function notify(ex: Executor, userId: string, n: { kind: Kind; title: string; body?: string; link?: string; dedupeKey?: string }) {
  await ex
    .insert(notifications)
    .values({ userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null })
    .onConflictDoNothing();
}

/** New story in a topic the reader follows (topic preferences). One notification per story per user. */
export async function notifyNewStory(storyId: string) {
  const [s] = await db.select({ id: stories.id, slug: stories.slug, headline: stories.headline, topicSlug: topics.slug, topicName: topics.name, status: stories.status }).from(stories).leftJoin(topics, eq(topics.id, stories.topicId)).where(eq(stories.id, storyId));
  if (!s || s.status !== "published" || !s.topicSlug) return 0;
  const rows = await db.execute(sql`
    INSERT INTO notifications (user_id, kind, title, body, link, dedupe_key)
    SELECT p.user_id, 'new_story', ${`New in ${s.topicName}`}, ${s.headline}, ${`/stories/${s.slug}`}, ${`story:${s.id}`}
    FROM user_preferences p JOIN users u ON u.id = p.user_id
    WHERE p.topic_preferences ? ${s.topicSlug} AND u.account_status IN ('active','restricted')
    ON CONFLICT DO NOTHING`);
  return (rows as unknown as { count?: number }).count ?? 0;
}

/** Someone replied to your explanation (unless you've blocked them). */
export async function notifyReply(replyId: string) {
  const [r] = await db.select().from(comments).where(eq(comments.id, replyId));
  if (!r?.parentCommentId) return;
  const [parent] = await db.select().from(comments).where(eq(comments.id, r.parentCommentId));
  if (!parent || parent.userId === r.userId || parent.status !== "active") return;
  const [blocked] = await db.select().from(userBlocks).where(and(eq(userBlocks.blockerId, parent.userId), eq(userBlocks.blockedId, r.userId)));
  if (blocked) return;
  const [author] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, r.userId));
  const [s] = await db.select({ slug: stories.slug, headline: stories.headline }).from(stories).where(eq(stories.id, r.storyId));
  await notify(db, parent.userId, { kind: "comment_reply", title: `${author?.name ?? "Someone"} replied to your explanation`, body: s?.headline, link: s ? `/stories/${s.slug}/discussion?perspective=newest#c-${parent.id}` : undefined, dedupeKey: `reply:${r.id}` });
}

export async function listNotifications(actor: Actor, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, actor.id)).orderBy(desc(notifications.createdAt)).limit(Math.min(limit, 100));
}

export async function unreadCount(userId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function markRead(actor: Actor, ids?: string[]) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt), ids?.length ? inArray(notifications.id, ids) : undefined));
}

/**
 * Email digests. Daily users get unread notifications from the last day;
 * weekly users get them plus their weekly summary on Mondays. Nothing is
 * emailed to users who chose "off" or have no email.
 */
export async function queueDigests(now = new Date()) {
  const isMonday = now.getUTCDay() === 1;
  const recipients = await db
    .select({ id: users.id, email: users.email, name: users.displayName, freq: sql<string>`${userPreferences.notificationPreferences} ->> 'frequency'` })
    .from(users)
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(and(eq(users.accountStatus, "active"), sql`${users.email} IS NOT NULL`, sql`${userPreferences.notificationPreferences} ->> 'frequency' IN ('daily','weekly')`));
  let queued = 0;
  for (const u of recipients) {
    if (u.freq === "weekly" && !isMonday) continue;
    const kind = u.freq === "weekly" ? "weekly_digest" : "daily_digest";
    // One digest per user per period.
    const periodKey = u.freq === "weekly" ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 10);
    const [already] = await db.select({ id: emailOutbox.id }).from(emailOutbox).where(and(eq(emailOutbox.userId, u.id), eq(emailOutbox.kind, `${kind}:${periodKey}`)));
    if (already) continue;
    const pending = await db.select().from(notifications).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt), isNull(notifications.emailedAt))).orderBy(desc(notifications.createdAt)).limit(20);
    const summary = u.freq === "weekly" ? await weeklySummary(u.id, now) : null;
    if (!pending.length && !(summary && summary.answered > 0)) continue;
    const base = process.env.APP_URL?.replace(/\/$/, "") ?? "";
    const lines = [
      `Hi ${u.name ?? "there"},`,
      "",
      ...(summary ? [`This week you answered ${summary.answered} question${summary.answered === 1 ? "" : "s"}${summary.changed ? ` and updated ${summary.changed}` : ""}.`, ""] : []),
      ...pending.map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}${n.link ? `\n  ${base}${n.link}` : ""}`),
      "",
      `Change how often we email you: ${base}/profile`,
    ];
    await db.insert(emailOutbox).values({ userId: u.id, toAddress: u.email!, subject: summary ? "Your week in review" : "New on your topics", text: lines.join("\n"), kind: `${kind}:${periodKey}` });
    if (pending.length) await db.update(notifications).set({ emailedAt: now }).where(inArray(notifications.id, pending.map((p) => p.id)));
    queued++;
  }
  return queued;
}

export async function sendPendingEmails(limit = 100) {
  const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.status, "pending")).limit(limit);
  for (const r of rows) {
    const res = await sendEmail({ to: r.toAddress, subject: r.subject, text: r.text });
    await db.update(emailOutbox).set({ status: res.status, error: res.error ?? null, sentAt: res.status === "sent" ? new Date() : null }).where(eq(emailOutbox.id, r.id));
  }
  return rows.length;
}
