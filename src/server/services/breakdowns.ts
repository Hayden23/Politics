import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { questions, ratingHistory, ratings, userDemographics } from "@/server/db/schema";
import { notFound } from "@/lib/errors";
import type { Actor } from "@/server/auth/roles";
import { aggregate, meetsThreshold, type CountRow, type Distribution } from "@/domain/aggregation";
import { IDEOLOGY_LABELS, type IdeologyGroup } from "@/domain/lean";
import { AGE_RANGES, GEOGRAPHIC_TYPES } from "@/domain/topics";
import { getResults } from "./reader";

/**
 * Opt-in breakdowns of a question's results. Only people who consented to
 * demographic processing are counted, groups below the threshold are never
 * shown (not even their counts), and every breakdown is unweighted and
 * labelled as not representative.
 */
export const thresholds = () => ({
  ideology: Number(process.env.IDEOLOGY_RESULTS_THRESHOLD ?? 100),
  state: Number(process.env.STATE_RESULTS_THRESHOLD ?? 100),
  demographic: Number(process.env.DEMOGRAPHIC_RESULTS_THRESHOLD ?? 100),
});

export type GroupResult =
  | { key: string; label: string; available: true; distribution: Distribution }
  | { key: string; label: string; available: false };

const IDEOLOGY_SQL = sql<string | null>`CASE
  WHEN ${userDemographics.politicalSelfIdentification} IN ('very liberal','liberal') THEN 'left'
  WHEN ${userDemographics.politicalSelfIdentification} = 'moderate' THEN 'center'
  WHEN ${userDemographics.politicalSelfIdentification} IN ('conservative','very conservative') THEN 'right'
  ELSE NULL END`;

async function groupedCounts(questionId: string, groupExpr: ReturnType<typeof sql>) {
  const rows = await db
    .select({
      group: sql<string | null>`${groupExpr}`,
      responseType: ratings.responseType,
      responseValue: ratings.responseValue,
      count: sql<number>`count(*)::int`,
    })
    .from(ratings)
    .innerJoin(userDemographics, eq(userDemographics.userId, ratings.userId))
    .where(and(eq(ratings.questionId, questionId), isNotNull(userDemographics.consentAt)))
    .groupBy(sql`1`, ratings.responseType, ratings.responseValue);
  const by = new Map<string, CountRow[]>();
  for (const r of rows) {
    if (!r.group) continue;
    by.set(r.group, [...(by.get(r.group) ?? []), { responseType: r.responseType, responseValue: r.responseValue, count: r.count }]);
  }
  return by;
}

function shape(by: Map<string, CountRow[]>, keys: readonly string[], label: (k: string) => string, threshold: number, supportGrouping: boolean): GroupResult[] {
  return keys.map((key) => {
    const d = aggregate(by.get(key) ?? [], { supportGrouping });
    return meetsThreshold(d.validCount, threshold) ? { key, label: label(key), available: true as const, distribution: d } : { key, label: label(key), available: false as const };
  });
}

async function questionFor(questionId: string) {
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!q) throw notFound("Question not found");
  return q;
}

export async function ideologyBreakdown(questionId: string) {
  const q = await questionFor(questionId);
  const t = thresholds().ideology;
  const by = await groupedCounts(questionId, IDEOLOGY_SQL);
  const groups = shape(by, ["left", "center", "right"], (k) => IDEOLOGY_LABELS[k as IdeologyGroup], t, q.scaleConfig.supportGrouping);
  const left = groups[0], right = groups[2];
  // The headline comparison: support among the left minus support among the right.
  const gap =
    left.available && right.available && left.distribution.grouping && right.distribution.grouping
      ? { supportGap: left.distribution.grouping.support.percent - right.distribution.grouping.support.percent }
      : null;
  return { dimension: "ideology" as const, threshold: t, groups, gap };
}

export async function stateBreakdown(questionId: string) {
  const q = await questionFor(questionId);
  const t = thresholds().state;
  const by = await groupedCounts(questionId, sql`${userDemographics.stateCode}`);
  const available = [...by.keys()].sort();
  return { dimension: "state" as const, threshold: t, groups: shape(by, available, (k) => k, t, q.scaleConfig.supportGrouping).filter((g) => g.available) };
}

export async function demographicBreakdown(questionId: string, dimension: "age" | "area") {
  const q = await questionFor(questionId);
  const t = thresholds().demographic;
  const expr = dimension === "age" ? sql`${userDemographics.ageRange}` : sql`${userDemographics.geographicType}`;
  const keys = dimension === "age" ? AGE_RANGES : GEOGRAPHIC_TYPES;
  const by = await groupedCounts(questionId, expr);
  return { dimension, threshold: t, groups: shape(by, keys, (k) => (dimension === "area" ? k[0].toUpperCase() + k.slice(1) : k), t, q.scaleConfig.supportGrouping) };
}

/**
 * Opinion change: how many respondents changed their answer after first
 * submitting, and in which direction. Aggregate only.
 */
export async function changeStats(questionId: string) {
  const rows = await db.execute<{ first_type: string; first_value: number | null; cur_type: string; cur_value: number | null }>(sql`
    SELECT DISTINCT ON (r.id) h.new_type AS first_type, h.new_value AS first_value, r.response_type AS cur_type, r.response_value AS cur_value
    FROM ${ratings} r JOIN ${ratingHistory} h ON h.rating_id = r.id
    WHERE r.question_id = ${questionId}
    ORDER BY r.id, h.changed_at ASC`);
  let changed = 0, towardSupport = 0, towardOppose = 0, becameUncertain = 0, resolvedUncertain = 0;
  for (const r of rows) {
    if (r.first_type === r.cur_type && r.first_value === r.cur_value) continue;
    changed++;
    if (r.cur_type === "uncertain") becameUncertain++;
    else if (r.first_type === "uncertain") resolvedUncertain++;
    else if ((r.cur_value ?? 0) > (r.first_value ?? 0)) towardSupport++;
    else towardOppose++;
  }
  return { respondents: rows.length, changed, towardSupport, towardOppose, becameUncertain, resolvedUncertain };
}

/** Everything for the "Breakdowns" view of a story, behind the same rating gate as results. */
export async function storyBreakdowns(storyRef: string, actor: Actor | null, opts: { preview?: boolean } = {}) {
  const results = await getResults(storyRef, actor, opts);
  const current = results.results[0];
  if (!current) return { storyId: results.storyId, slug: results.slug, headline: results.headline, question: null };
  const qid = current.question.id;
  const [ideology, states, age, area, change] = await Promise.all([ideologyBreakdown(qid), stateBreakdown(qid), demographicBreakdown(qid, "age"), demographicBreakdown(qid, "area"), changeStats(qid)]);
  return { storyId: results.storyId, slug: results.slug, headline: results.headline, question: current.question, overall: current.distribution, ideology, states, age, area, change };
}
