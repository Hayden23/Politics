import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { questions, ratingHistory, ratings, stories, topics } from "@/server/db/schema";
import { direction } from "@/domain/scale";

/**
 * A private weekly recap for one person: what they answered, what they
 * changed, and where their answer sat relative to other participants.
 * Never assigns an ideology label.
 */
export async function weeklySummary(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400_000);
  const rows = await db
    .select({ ratingId: ratings.id, questionId: ratings.questionId, type: ratings.responseType, value: ratings.responseValue, createdAt: ratings.createdAt, slug: stories.slug, headline: stories.headline, topic: topics.name })
    .from(ratings)
    .innerJoin(questions, eq(questions.id, ratings.questionId))
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(and(eq(ratings.userId, userId), gte(ratings.updatedAt, since)));
  const [changes] = await db
    .select({ n: sql<number>`count(DISTINCT ${ratingHistory.ratingId})::int` })
    .from(ratingHistory)
    .innerJoin(ratings, eq(ratings.id, ratingHistory.ratingId))
    .where(and(eq(ratings.userId, userId), gte(ratingHistory.changedAt, since), sql`${ratingHistory.previousType} IS NOT NULL`));
  const items = [];
  for (const r of rows) {
    const [agg] = await db
      .select({
        support: sql<number>`count(*) FILTER (WHERE ${ratings.responseValue} > 4)::int`,
        oppose: sql<number>`count(*) FILTER (WHERE ${ratings.responseValue} < 4)::int`,
        valid: sql<number>`count(*) FILTER (WHERE ${ratings.responseType} = 'scale')::int`,
      })
      .from(ratings)
      .where(eq(ratings.questionId, r.questionId));
    const d = direction(r.type, r.value);
    const sameSide = d === 1 ? agg.support : d === -1 ? agg.oppose : null;
    items.push({
      slug: r.slug,
      headline: r.headline,
      topic: r.topic,
      newThisWeek: r.createdAt >= since,
      // Share of valid responses on the same side as you (null for neutral/uncertain).
      sameSidePercent: sameSide !== null && agg.valid > 0 ? (sameSide / agg.valid) * 100 : null,
      validResponses: agg.valid,
    });
  }
  const byTopic = new Map<string, number>();
  for (const i of items) if (i.topic) byTopic.set(i.topic, (byTopic.get(i.topic) ?? 0) + 1);
  return {
    from: since.toISOString(),
    to: now.toISOString(),
    answered: items.filter((i) => i.newThisWeek).length,
    changed: changes?.n ?? 0,
    topics: [...byTopic.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    items,
  };
}
