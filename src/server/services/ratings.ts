import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { questions, ratingHistory, ratings, stories, topics } from "@/server/db/schema";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { Actor } from "@/server/auth/roles";
import { validateResponse } from "@/domain/scale";

async function loadAnswerableQuestion(questionId: string, version: number | undefined) {
  const [row] = await db
    .select({ q: questions, storyStatus: stories.status })
    .from(questions)
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .where(eq(questions.id, questionId));
  if (!row || row.storyStatus !== "published" || row.q.status === "draft") throw notFound("Question not found");
  if (row.q.status === "retired") throw conflict("This question has been replaced by a newer version", "question_retired");
  if (version !== undefined && version !== row.q.version) throw conflict("The question changed while you were reading. Please review it again.", "version_mismatch");
  return row.q;
}

function parse(config: Parameters<typeof validateResponse>[0], response: unknown) {
  try {
    return validateResponse(config, response);
  } catch (e) {
    throw badRequest((e as Error).message, "invalid_response");
  }
}

/**
 * Initial submission. Idempotent: the unique (user, question) constraint plus
 * ON CONFLICT DO NOTHING means concurrent or repeated requests create exactly
 * one rating. Repeating the same answer returns the existing rating; a
 * different answer must go through `updateRating` so it is recorded as a change.
 */
export async function submitRating(actor: Actor, questionId: string, input: { questionVersion?: number; response: unknown }) {
  const q = await loadAnswerableQuestion(questionId, input.questionVersion);
  const r = parse(q.scaleConfig, input.response);
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(ratings)
      .values({ userId: actor.id, questionId, questionVersion: q.version, responseType: r.responseType, responseValue: r.responseValue })
      .onConflictDoNothing({ target: [ratings.userId, ratings.questionId] })
      .returning();
    if (inserted[0]) {
      await tx.insert(ratingHistory).values({ ratingId: inserted[0].id, previousValue: null, previousType: null, newValue: r.responseValue, newType: r.responseType, questionVersion: q.version });
      return { rating: inserted[0], created: true };
    }
    const [existing] = await tx.select().from(ratings).where(and(eq(ratings.userId, actor.id), eq(ratings.questionId, questionId)));
    if (existing.responseType === r.responseType && existing.responseValue === r.responseValue) return { rating: existing, created: false };
    throw conflict("You've already answered this question. Use “Update my view” to change it.", "already_rated");
  });
}

export async function updateRating(actor: Actor, questionId: string, input: { response: unknown }) {
  const q = await loadAnswerableQuestion(questionId, undefined);
  const r = parse(q.scaleConfig, input.response);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(ratings).where(and(eq(ratings.userId, actor.id), eq(ratings.questionId, questionId))).for("update");
    if (!existing) throw notFound("You haven't answered this question yet");
    if (existing.responseType === r.responseType && existing.responseValue === r.responseValue) return { rating: existing, changed: false };
    const [updated] = await tx
      .update(ratings)
      .set({ responseType: r.responseType, responseValue: r.responseValue, updatedAt: new Date() })
      .where(eq(ratings.id, existing.id))
      .returning();
    await tx.insert(ratingHistory).values({
      ratingId: existing.id,
      previousValue: existing.responseValue,
      previousType: existing.responseType,
      newValue: r.responseValue,
      newType: r.responseType,
      questionVersion: q.version,
    });
    return { rating: updated, changed: true };
  });
}

/** The signed-in user's own opinion history. Never callable for another user. */
export async function myRatings(actor: Actor, opts: { topic?: string } = {}) {
  const rows = await db
    .select({
      rating: ratings,
      questionText: questions.questionText,
      questionStatus: questions.status,
      scale: questions.scaleConfig,
      storyId: stories.id,
      slug: stories.slug,
      headline: stories.headline,
      storyStatus: stories.status,
      topicSlug: topics.slug,
      topicName: topics.name,
    })
    .from(ratings)
    .innerJoin(questions, eq(questions.id, ratings.questionId))
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(and(eq(ratings.userId, actor.id), opts.topic ? eq(topics.slug, opts.topic) : undefined))
    .orderBy(desc(ratings.updatedAt));
  const ids = rows.map((r) => r.rating.id);
  const history = ids.length ? await db.select().from(ratingHistory).where(inArray(ratingHistory.ratingId, ids)).orderBy(ratingHistory.changedAt) : [];
  const byRating = new Map<string, typeof history>();
  for (const h of history) byRating.set(h.ratingId, [...(byRating.get(h.ratingId) ?? []), h]);
  return rows.map((r) => {
    const h = byRating.get(r.rating.id) ?? [];
    const first = h[0];
    const original = first ? { type: first.newType!, value: first.newValue } : { type: r.rating.responseType, value: r.rating.responseValue };
    const changed = original.type !== r.rating.responseType || original.value !== r.rating.responseValue;
    return {
      ratingId: r.rating.id,
      questionId: r.rating.questionId,
      questionVersion: r.rating.questionVersion,
      questionText: r.questionText,
      questionRetired: r.questionStatus === "retired",
      scale: r.scale,
      storyId: r.storyId,
      slug: r.slug,
      headline: r.headline,
      storyAvailable: r.storyStatus === "published",
      topicSlug: r.topicSlug,
      topicName: r.topicName,
      current: { type: r.rating.responseType, value: r.rating.responseValue },
      original,
      changed,
      firstAnsweredAt: r.rating.createdAt.toISOString(),
      updatedAt: r.rating.updatedAt.toISOString(),
      history: h.map((x) => ({ type: x.newType, value: x.newValue, at: x.changedAt.toISOString() })),
    };
  });
}

export async function ratingCountForQuestion(questionId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(ratings).where(eq(ratings.questionId, questionId));
  return r?.n ?? 0;
}
