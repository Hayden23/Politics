import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { questions, ratings, stories, topics } from "@/server/db/schema";
import type { Actor } from "@/server/auth/roles";
import { questionDistribution } from "./reader";
import { SMALL_SAMPLE_THRESHOLD } from "@/domain/aggregation";

/**
 * Explore lists live questions with participation counts. A distribution is
 * included only for questions the viewer has already answered, so Explore
 * can never be used to see results before forming an independent view.
 */
export async function exploreQuestions(actor: Actor | null, opts: { topic?: string; sort?: "popular" | "recent"; limit?: number } = {}) {
  const count = sql<number>`(SELECT count(*)::int FROM ratings r WHERE r.question_id = ${questions.id})`;
  const answered = actor ? sql<boolean>`EXISTS (SELECT 1 FROM ratings r WHERE r.question_id = ${questions.id} AND r.user_id = ${actor.id})` : sql<boolean>`false`;
  const rows = await db
    .select({ q: questions, slug: stories.slug, headline: stories.headline, storyId: stories.id, topicSlug: topics.slug, topicName: topics.name, responses: count, answered })
    .from(questions)
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(and(eq(questions.status, "published"), eq(stories.status, "published"), opts.topic ? eq(topics.slug, opts.topic) : undefined))
    .orderBy(opts.sort === "recent" ? desc(questions.publishedAt) : desc(count), desc(questions.publishedAt))
    .limit(Math.min(opts.limit ?? 20, 50));
  return Promise.all(
    rows.map(async (r) => ({
      questionId: r.q.id,
      questionText: r.q.questionText,
      storyId: r.storyId,
      slug: r.slug,
      headline: r.headline,
      topicSlug: r.topicSlug,
      topicName: r.topicName,
      responses: r.responses,
      publishedAt: r.q.publishedAt?.toISOString() ?? null,
      answered: !!r.answered,
      result: r.answered ? await questionDistribution(r.q.id) : null,
    })),
  );
}

/**
 * Daily cumulative support/neutral/oppose shares. Returned only when there is
 * enough data to be meaningful; otherwise `null` and the UI says so.
 */
export async function questionTrend(questionId: string) {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${ratings.createdAt}), 'YYYY-MM-DD')`,
      oppose: sql<number>`count(*) FILTER (WHERE ${ratings.responseValue} < 4)::int`,
      neutral: sql<number>`count(*) FILTER (WHERE ${ratings.responseValue} = 4)::int`,
      support: sql<number>`count(*) FILTER (WHERE ${ratings.responseValue} > 4)::int`,
    })
    .from(ratings)
    .where(and(eq(ratings.questionId, questionId), eq(ratings.responseType, "scale")))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  // Uses each rating's current value at its first-answered date; changes are tracked separately.
  let o = 0, n = 0, s = 0;
  const points = rows.map((r) => {
    o += r.oppose; n += r.neutral; s += r.support;
    const total = o + n + s;
    return { day: r.day, total, oppose: (o / total) * 100, neutral: (n / total) * 100, support: (s / total) * 100 };
  });
  const enough = points.length >= 3 && (points.at(-1)?.total ?? 0) >= SMALL_SAMPLE_THRESHOLD * 2;
  return enough ? points : null;
}
