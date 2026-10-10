import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { bookmarks, questions, ratings, sources, stories, storySources, storyVersions, topics } from "@/server/db/schema";
import { forbidden, notFound } from "@/lib/errors";
import { type Actor, isEditor } from "@/server/auth/roles";
import { aggregate, type CountRow } from "@/domain/aggregation";

export const POPULATION_LABEL = "Participating users' responses";
export const POPULATION_DESCRIPTION =
  "Registered users of this app who chose to answer this question. These are not a representative sample of any population and are not weighted.";

const WORDS_PER_MINUTE = 220;

export function readingMinutes(...texts: (string | null | undefined)[]) {
  const words = texts.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function summarize(briefing: string, maxLen = 180) {
  const first = briefing.trim().split(/\n\s*\n/)[0] ?? "";
  if (first.length <= maxLen) return first;
  const cut = first.slice(0, maxLen);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
}

/** Reorders so no more than two stories in a row share a topic, preserving order otherwise. */
export function diversify<T extends { topicSlug: string | null }>(items: T[]): T[] {
  const out: T[] = [];
  const queue = [...items];
  while (queue.length) {
    const lastTwo = out.slice(-2).map((i) => i.topicSlug);
    const blocked = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : undefined;
    const idx = blocked === undefined ? 0 : queue.findIndex((i) => i.topicSlug !== blocked);
    out.push(queue.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}

export type StoryCard = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  topicSlug: string | null;
  topicName: string | null;
  date: string;
  readingMinutes: number;
  rated: boolean;
  bookmarked: boolean;
};

/**
 * Discover feed. Ranking uses only editorial priority, recency and topic
 * diversity — never how the viewer or anyone else answered.
 */
export async function listFeed(actor: Actor | null, opts: { topic?: string; offset?: number; limit?: number; answered?: boolean } = {}) {
  const limit = Math.min(opts.limit ?? 12, 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const answeredSql = actor
    ? sql<boolean>`EXISTS (SELECT 1 FROM ratings r JOIN questions q ON q.id = r.question_id WHERE q.story_id = ${stories.id} AND r.user_id = ${actor.id})`
    : sql<boolean>`false`;
  const bookmarkedSql = actor ? sql<boolean>`EXISTS (SELECT 1 FROM bookmarks b WHERE b.story_id = ${stories.id} AND b.user_id = ${actor.id})` : sql<boolean>`false`;
  const where = and(
    eq(stories.status, "published"),
    opts.topic ? eq(topics.slug, opts.topic) : undefined,
    opts.answered === undefined || !actor ? undefined : opts.answered ? answeredSql : sql`NOT ${answeredSql}`,
  );
  const rows = await db
    .select({ s: stories, topicSlug: topics.slug, topicName: topics.name, rated: answeredSql, bookmarked: bookmarkedSql })
    .from(stories)
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(where)
    .orderBy(desc(sql`(${stories.editorialPriority} > 0)`), desc(stories.publishedAt), desc(stories.id))
    .limit(limit + 1)
    .offset(offset);
  const items: StoryCard[] = rows.slice(0, limit).map((r) => ({
    id: r.s.id,
    slug: r.s.slug,
    headline: r.s.headline,
    summary: summarize(r.s.briefing),
    topicSlug: r.topicSlug,
    topicName: r.topicName,
    date: (r.s.eventAt ?? r.s.publishedAt ?? r.s.createdAt).toISOString(),
    readingMinutes: readingMinutes(r.s.briefing, ...r.s.keyFacts.map((f) => f.text)),
    rated: !!r.rated,
    bookmarked: !!r.bookmarked,
  }));
  return { items: diversify(items), nextOffset: rows.length > limit ? offset + limit : null };
}

export async function listTopics() {
  return db.select({ id: topics.id, slug: topics.slug, name: topics.name }).from(topics).where(eq(topics.active, true)).orderBy(asc(topics.name));
}

async function liveQuestion(storyId: string) {
  const [q] = await db.select().from(questions).where(and(eq(questions.storyId, storyId), eq(questions.status, "published"))).orderBy(desc(questions.version)).limit(1);
  return q ?? null;
}

/** Has this user answered any version of this story's question? Used to gate the post-rating reveal. */
export async function userRatingForStory(userId: string, storyId: string) {
  const rows = await db
    .select({ rating: ratings, version: questions.version, status: questions.status })
    .from(ratings)
    .innerJoin(questions, eq(questions.id, ratings.questionId))
    .where(and(eq(ratings.userId, userId), eq(questions.storyId, storyId)))
    .orderBy(desc(questions.version));
  return rows;
}

async function loadVisibleStory(slugOrId: string, actor: Actor | null, opts: { preview?: boolean } = {}) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(slugOrId);
  const [row] = await db
    .select({ s: stories, topicSlug: topics.slug, topicName: topics.name })
    .from(stories)
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(isUuid ? eq(stories.id, slugOrId) : eq(stories.slug, slugOrId));
  if (!row) throw notFound("Story not found");
  const canPreview = opts.preview && isEditor(actor);
  if (row.s.status !== "published" && !canPreview) throw notFound("Story not found");
  return { ...row, preview: !!canPreview && row.s.status !== "published", editorPreview: !!canPreview };
}

/**
 * The source-blind briefing. Contains no publisher identity, no original
 * headline, no results and no comments — those are served only after rating.
 */
export async function getBriefing(slugOrId: string, actor: Actor | null, opts: { preview?: boolean } = {}) {
  const { s, topicSlug, topicName, preview } = await loadVisibleStory(slugOrId, actor, opts);
  let question = await liveQuestion(s.id);
  if (preview) {
    const [draft] = await db.select().from(questions).where(and(eq(questions.storyId, s.id), eq(questions.status, "draft"))).orderBy(desc(questions.version)).limit(1);
    question = draft ?? question;
  }
  const mine = actor ? await userRatingForStory(actor.id, s.id) : [];
  const current = question ? mine.find((m) => m.rating.questionId === question!.id) : undefined;
  const [bm] = actor ? await db.select().from(bookmarks).where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.storyId, s.id))) : [];
  return {
    id: s.id,
    slug: s.slug,
    headline: s.headline,
    briefing: s.briefing,
    keyFacts: s.keyFacts.map((f) => ({ text: f.text })),
    disputedClaims: s.disputedClaims.map((f) => ({ text: f.text })),
    uncertainties: s.uncertainties.map((f) => ({ text: f.text })),
    topicSlug,
    topicName,
    date: (s.eventAt ?? s.publishedAt ?? s.createdAt).toISOString(),
    updatedVersion: s.currentVersion > 1,
    readingMinutes: readingMinutes(s.briefing),
    question: question && { id: question.id, text: question.questionText, version: question.version, scale: question.scaleConfig },
    myRating: current ? { type: current.rating.responseType, value: current.rating.responseValue } : null,
    /** True when the user answered an earlier version of the question but not the current one. */
    answeredEarlierVersion: !current && mine.length > 0,
    hasRatedStory: mine.length > 0,
    bookmarked: !!bm,
    preview,
  };
}

async function assertRevealAllowed(storyId: string, actor: Actor | null, preview: boolean) {
  if (preview && isEditor(actor)) return;
  if (!actor) throw forbidden("Submit your view to see results");
  const mine = await userRatingForStory(actor.id, storyId);
  if (!mine.length) throw forbidden("Submit your view to see results");
}

export async function questionDistribution(questionId: string) {
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!q) throw notFound("Question not found");
  const rows = await db
    .select({ responseType: ratings.responseType, responseValue: ratings.responseValue, count: sql<number>`count(*)::int` })
    .from(ratings)
    .where(eq(ratings.questionId, questionId))
    .groupBy(ratings.responseType, ratings.responseValue);
  const [range] = await db
    .select({ first: sql<Date | null>`min(${ratings.createdAt})`, last: sql<Date | null>`max(${ratings.updatedAt})` })
    .from(ratings)
    .where(eq(ratings.questionId, questionId));
  const dist = aggregate(rows as CountRow[], { min: q.scaleConfig.min, max: q.scaleConfig.max, supportGrouping: q.scaleConfig.supportGrouping });
  return {
    question: { id: q.id, text: q.questionText, version: q.version, status: q.status, scale: q.scaleConfig, publishedAt: q.publishedAt, retiredAt: q.retiredAt },
    distribution: dist,
    dateRange: { from: range?.first ? new Date(range.first).toISOString() : null, to: range?.last ? new Date(range.last).toISOString() : null },
    population: POPULATION_LABEL,
    populationDescription: POPULATION_DESCRIPTION,
    weighting: "Unweighted",
  };
}

/** Post-rating results for every version of the story's question, newest first. */
export async function getResults(storyId: string, actor: Actor | null, opts: { preview?: boolean } = {}) {
  const { s, editorPreview } = await loadVisibleStory(storyId, actor, opts);
  await assertRevealAllowed(s.id, actor, editorPreview);
  const qs = await db.select().from(questions).where(and(eq(questions.storyId, s.id), isNotNull(questions.publishedAt))).orderBy(desc(questions.version));
  const results = [];
  for (const q of qs) results.push(await questionDistribution(q.id));
  const mine = actor ? await userRatingForStory(actor.id, s.id) : [];
  return {
    storyId: s.id,
    slug: s.slug,
    headline: s.headline,
    results,
    myRatings: mine.map((m) => ({ questionId: m.rating.questionId, questionVersion: m.version, type: m.rating.responseType, value: m.rating.responseValue, updatedAt: m.rating.updatedAt })),
  };
}

/** The evidence trail, revealed only after rating. */
export async function getSources(storyId: string, actor: Actor | null, opts: { preview?: boolean } = {}) {
  const { s, editorPreview } = await loadVisibleStory(storyId, actor, opts);
  await assertRevealAllowed(s.id, actor, editorPreview);
  const rows = await db
    .select({ source: sources, link: storySources })
    .from(storySources)
    .innerJoin(sources, eq(sources.id, storySources.sourceId))
    .where(and(eq(storySources.storyId, s.id), eq(storySources.storyVersion, s.currentVersion)))
    .orderBy(asc(storySources.relationshipType), asc(sources.publisherName));
  const corrections = await db
    .select({ version: storyVersions.versionNumber, note: storyVersions.correctionNote, at: storyVersions.publishedAt })
    .from(storyVersions)
    .where(and(eq(storyVersions.storyId, s.id), isNotNull(storyVersions.correctionNote), isNotNull(storyVersions.publishedAt)))
    .orderBy(desc(storyVersions.versionNumber));
  return {
    storyId: s.id,
    slug: s.slug,
    headline: s.headline,
    sources: rows.map(({ source, link }) => ({
      id: source.id,
      publisherName: source.publisherName,
      originalHeadline: source.originalHeadline,
      author: source.author,
      url: source.sourceUrl,
      sourceType: source.sourceType,
      publishedAt: source.publishedAt?.toISOString() ?? null,
      relationship: link.relationshipType,
      claimsSupported: link.claimsSupported ?? [],
      linkStatus: source.linkStatus,
    })),
    corrections: corrections.map((c) => ({ version: c.version, note: c.note!, at: c.at?.toISOString() ?? null })),
  };
}

export async function storiesByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(stories).where(inArray(stories.id, ids));
}
