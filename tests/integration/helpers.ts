import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import type { Actor, Role } from "@/server/auth/roles";
import { TOPICS } from "@/domain/topics";
import { topics } from "@/server/db/schema";
import * as editorial from "@/server/services/editorial";

export async function resetDb() {
  const rows = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`);
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`SET session_replication_role = replica; TRUNCATE ${names} CASCADE; SET session_replication_role = DEFAULT;`));
  await db.insert(topics).values(TOPICS.map((t) => ({ slug: t.slug, name: t.name })));
}

let n = 0;
export async function makeUser(role: Role = "user", name?: string): Promise<Actor> {
  n++;
  const [u] = await db
    .insert(users)
    .values({ authProviderId: `test:${n}:${Math.random()}`, email: `u${n}-${Date.now()}@example.test`, displayName: name ?? `User ${n}`, role, onboardedAt: new Date() })
    .returning();
  return { id: u.id, role: u.role, email: u.email, displayName: u.displayName, accountStatus: "active", restrictedUntil: null, onboarded: true };
}

export async function topicId(slug = "economy") {
  const [t] = await db.select().from(topics).where(sql`${topics.slug} = ${slug}`);
  return t.id;
}

export const BRIEFING =
  "The city council voted on Tuesday to send a proposal to voters that would raise the local sales tax by half a percentage point to fund road repairs. Supporters on the council said the roads have deteriorated and the state formula does not cover the backlog. Opponents said the tax would fall hardest on lower-income households. The measure has not been enacted; it would take effect only if approved by voters in November.";

/** Creates a story and drives it through review → approval → publication like an editor would. */
export async function publishedStory(editor: Actor, opts: { headline?: string; topic?: string; question?: string } = {}) {
  const s = await editorial.createStory(editor, {
    headline: opts.headline ?? "City asks voters to approve a sales tax for road repairs",
    briefing: BRIEFING,
    keyFacts: [{ text: "The proposed increase is 0.5 percentage points." }],
    disputedClaims: [{ text: "Opponents say the tax is regressive." }],
    uncertainties: [{ text: "Projected revenue depends on future spending." }],
    topicId: await topicId(opts.topic),
  });
  await editorial.attachSource(editor, s.id, {
    publisherName: "Example Gazette",
    originalHeadline: "Council punts tax hike to voters",
    sourceUrl: "https://example.org/news/council-tax",
    sourceType: "news_article",
    relationshipType: "factual_reporting",
  });
  const q = await editorial.setQuestion(editor, s.id, { questionText: opts.question ?? "Do you support the proposed sales tax increase for road repairs?", allowUncertain: true, supportGrouping: true });
  await editorial.submitForReview(editor, s.id);
  await editorial.approveStory(editor, s.id);
  const published = await editorial.publishStory(editor, s.id);
  return { story: published, questionId: q.id };
}
