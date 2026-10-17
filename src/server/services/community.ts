import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { commentReactions, comments, hiddenComments, questions, ratings, stories, topics, userBlocks, userPreferences, users } from "@/server/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { type Actor, canPost, isEditor, isModerator } from "@/server/auth/roles";
import { direction, responseLabel } from "@/domain/scale";
import { userRatingForStory } from "./reader";
import { notifyReply } from "./notifications";

export const EDIT_WINDOW_HOURS = 24;

export const commentBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(10, "Share a bit more — at least 10 characters")
    .max(2000, "Keep it under 2,000 characters"),
});

export type Perspective = "all" | "different" | "insightful" | "newest";

/** Very small spam heuristics; human moderators handle everything else. */
export function spamProblem(body: string): string | null {
  const links = body.match(/https?:\/\//g)?.length ?? 0;
  if (links > 2) return "Too many links";
  if (/(.)\1{14,}/.test(body)) return "Repeated characters";
  const letters = body.replace(/[^A-Za-z]/g, "");
  if (letters.length > 40 && letters === letters.toUpperCase()) return "Please don't write in all caps";
  return null;
}

async function questionWithStory(questionId: string) {
  const [row] = await db
    .select({ q: questions, storyStatus: stories.status, storyId: stories.id })
    .from(questions)
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .where(eq(questions.id, questionId));
  if (!row || row.storyStatus !== "published" || row.q.status === "draft") throw notFound("Discussion not found");
  return row;
}

async function assertCanSeeDiscussion(actor: Actor | null, storyId: string) {
  if (isEditor(actor) || isModerator(actor)) return;
  if (!actor) throw forbidden("Submit your view to join the discussion");
  const mine = await userRatingForStory(actor.id, storyId);
  if (!mine.length) throw forbidden("Submit your view to join the discussion");
}

export async function listComments(actor: Actor | null, questionId: string, perspective: Perspective = "all") {
  const { storyId, q } = await questionWithStory(questionId);
  await assertCanSeeDiscussion(actor, storyId);

  const rows = await db
    .select({
      c: comments,
      authorName: users.displayName,
      authorStatus: users.accountStatus,
      shareRating: sql<boolean>`coalesce((${userPreferences.privacyPreferences} ->> 'showRatingOnComments')::boolean, false)`,
      authorType: ratings.responseType,
      authorValue: ratings.responseValue,
      insightful: sql<number>`(SELECT count(*)::int FROM comment_reactions cr WHERE cr.comment_id = ${comments.id} AND cr.reaction_type = 'insightful')`,
      reactedByMe: actor ? sql<boolean>`EXISTS (SELECT 1 FROM comment_reactions cr WHERE cr.comment_id = ${comments.id} AND cr.user_id = ${actor.id})` : sql<boolean>`false`,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .leftJoin(userPreferences, eq(userPreferences.userId, comments.userId))
    .leftJoin(ratings, and(eq(ratings.userId, comments.userId), eq(ratings.questionId, comments.questionId)))
    .where(eq(comments.questionId, questionId))
    .orderBy(desc(comments.createdAt))
    .limit(1000);

  let hidden = new Set<string>();
  let blocked = new Set<string>();
  if (actor) {
    hidden = new Set((await db.select({ id: hiddenComments.commentId }).from(hiddenComments).where(eq(hiddenComments.userId, actor.id))).map((r) => r.id));
    blocked = new Set((await db.select({ id: userBlocks.blockedId }).from(userBlocks).where(eq(userBlocks.blockerId, actor.id))).map((r) => r.id));
  }
  const [mine] = actor ? await db.select().from(ratings).where(and(eq(ratings.userId, actor.id), eq(ratings.questionId, questionId))) : [];
  const myDir = mine ? direction(mine.responseType, mine.responseValue) : null;

  const shaped = rows
    .filter((r) => !hidden.has(r.c.id) && !blocked.has(r.c.userId))
    .map((r) => {
      const gone = r.c.status !== "active";
      const shared = r.shareRating && r.authorType;
      return {
        id: r.c.id,
        parentId: r.c.parentCommentId,
        body: gone ? null : r.c.body,
        status: r.c.status,
        author: gone ? null : { id: r.c.userId, name: r.authorStatus === "deleted" ? "Deleted account" : (r.authorName ?? "Reader") },
        authorRating: !gone && shared ? { type: r.authorType!, value: r.authorValue, label: responseLabel(q.scaleConfig, r.authorType!, r.authorValue) } : null,
        authorDirection: shared ? direction(r.authorType!, r.authorValue) : undefined,
        insightful: r.insightful,
        reactedByMe: !!r.reactedByMe,
        mine: actor?.id === r.c.userId,
        canEdit: actor?.id === r.c.userId && !gone && Date.now() - r.c.createdAt.getTime() < EDIT_WINDOW_HOURS * 3600_000,
        edited: !!r.c.editedAt,
        createdAt: r.c.createdAt.toISOString(),
      };
    });

  const replies = new Map<string, typeof shaped>();
  for (const c of shaped) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  let roots = shaped.filter((c) => !c.parentId);
  // Removed or deleted comments only remain as placeholders when they anchor live replies.
  roots = roots.filter((c) => c.status === "active" || (replies.get(c.id) ?? []).some((r) => r.status === "active"));

  if (perspective === "different") {
    // Only authors who chose to share their rating can be matched, so the filter reveals nothing private.
    roots = roots.filter((c) => c.authorDirection !== undefined && c.authorDirection !== null && myDir !== null && c.authorDirection !== myDir);
  }
  if (perspective === "insightful" || perspective === "all") {
    roots.sort((a, b) => b.insightful - a.insightful || b.createdAt.localeCompare(a.createdAt));
  }
  if (perspective === "insightful") roots = roots.filter((c) => c.insightful > 0);

  const strip = <T extends { authorDirection?: unknown }>({ authorDirection: _d, ...rest }: T) => rest;
  return {
    questionId,
    storyId,
    perspective,
    comments: roots.map((c) => ({
      ...strip(c),
      replies: (replies.get(c.id) ?? []).filter((r) => r.status === "active").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(strip),
    })),
  };
}

export async function createComment(actor: Actor, questionId: string, input: { body: string; parentId?: string | null }) {
  if (!canPost(actor)) throw forbidden("Your account can't post right now. See your profile for details.");
  const { storyId, q } = await questionWithStory(questionId);
  if (q.status === "retired") throw conflict("This discussion is closed because the question was revised", "question_retired");
  const mine = await userRatingForStory(actor.id, storyId);
  if (!mine.length) throw forbidden("Submit your view before joining the discussion");
  const problem = spamProblem(input.body);
  if (problem) throw badRequest(problem, "spam");
  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, input.parentId));
    if (!parent || parent.questionId !== questionId) throw notFound("Comment not found");
    if (parent.status !== "active") throw conflict("You can't reply to a removed comment", "parent_gone");
    // Threads are one level deep: replying to a reply joins the same thread.
    parentId = parent.parentCommentId ?? parent.id;
  }
  // Exact duplicate within 10 minutes is treated as a double submit.
  const [dupe] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.userId, actor.id), eq(comments.questionId, questionId), eq(comments.body, input.body), sql`${comments.createdAt} > now() - interval '10 minutes'`));
  if (dupe) return dupe;
  const [c] = await db.insert(comments).values({ userId: actor.id, storyId, questionId, parentCommentId: parentId, body: input.body }).returning();
  if (parentId) await notifyReply(c.id).catch(() => {});
  return c;
}

async function ownComment(actor: Actor, id: string) {
  const [c] = await db.select().from(comments).where(eq(comments.id, id));
  if (!c || c.userId !== actor.id) throw notFound("Comment not found");
  return c;
}

export async function editComment(actor: Actor, id: string, body: string) {
  const c = await ownComment(actor, id);
  if (c.status !== "active") throw conflict("This comment can no longer be edited", "not_active");
  if (Date.now() - c.createdAt.getTime() > EDIT_WINDOW_HOURS * 3600_000) throw conflict(`Comments can be edited for ${EDIT_WINDOW_HOURS} hours after posting`, "edit_window");
  const problem = spamProblem(body);
  if (problem) throw badRequest(problem, "spam");
  const [u] = await db.update(comments).set({ body, editedAt: new Date(), updatedAt: new Date() }).where(eq(comments.id, id)).returning();
  return u;
}

/** Self-deletion: body is erased immediately; the row stays only to anchor replies. */
export async function deleteComment(actor: Actor, id: string) {
  const c = await ownComment(actor, id);
  if (c.status === "deleted") return;
  await db.update(comments).set({ status: "deleted", body: "[deleted]", deletedAt: new Date(), updatedAt: new Date() }).where(eq(comments.id, id));
}

export async function toggleReaction(actor: Actor, commentId: string, reaction: "insightful" = "insightful") {
  const [c] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!c || c.status !== "active") throw notFound("Comment not found");
  if (c.userId === actor.id) throw badRequest("You can't react to your own comment");
  await assertCanSeeDiscussion(actor, c.storyId);
  const deleted = await db
    .delete(commentReactions)
    .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, actor.id), eq(commentReactions.reactionType, reaction)))
    .returning();
  if (deleted.length) return { reacted: false };
  await db.insert(commentReactions).values({ commentId, userId: actor.id, reactionType: reaction }).onConflictDoNothing();
  return { reacted: true };
}

export async function hideComment(actor: Actor, commentId: string) {
  await db.insert(hiddenComments).values({ userId: actor.id, commentId }).onConflictDoNothing();
}

export async function blockUser(actor: Actor, userId: string) {
  if (userId === actor.id) throw badRequest("You can't block yourself");
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!u) throw notFound("User not found");
  await db.insert(userBlocks).values({ blockerId: actor.id, blockedId: userId }).onConflictDoNothing();
}

export async function unblockUser(actor: Actor, userId: string) {
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, userId)));
}

export async function listBlocked(actor: Actor) {
  return db
    .select({ id: users.id, name: users.displayName, since: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, actor.id));
}

/** Community hub: recently active discussions. Shows no opinion data. */
export async function activeDiscussions(actor: Actor | null, limit = 20) {
  const rows = await db
    .select({
      storyId: stories.id,
      slug: stories.slug,
      headline: stories.headline,
      topicName: topics.name,
      questionId: questions.id,
      comments: sql<number>`count(${comments.id})::int`,
      lastActivity: sql<Date>`max(${comments.createdAt})`,
    })
    .from(comments)
    .innerJoin(questions, eq(questions.id, comments.questionId))
    .innerJoin(stories, eq(stories.id, comments.storyId))
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(and(eq(stories.status, "published"), eq(questions.status, "published"), eq(comments.status, "active"), isNull(comments.parentCommentId)))
    .groupBy(stories.id, stories.slug, stories.headline, topics.name, questions.id)
    .orderBy(desc(sql`max(${comments.createdAt})`))
    .limit(limit);
  const rated = new Set<string>();
  if (actor && rows.length) {
    const r = await db
      .select({ storyId: questions.storyId })
      .from(ratings)
      .innerJoin(questions, eq(questions.id, ratings.questionId))
      .where(and(eq(ratings.userId, actor.id), inArray(questions.storyId, rows.map((x) => x.storyId))));
    r.forEach((x) => rated.add(x.storyId));
  }
  return rows.map((r) => ({ ...r, lastActivity: new Date(r.lastActivity).toISOString(), unlocked: rated.has(r.storyId) }));
}
