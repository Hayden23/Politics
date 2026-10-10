import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { analyticsEvents } from "@/server/db/schema";

export const EVENTS = [
  "onboarding_completed",
  "account_created",
  "story_viewed",
  "rating_submitted",
  "rating_updated",
  "results_viewed",
  "source_revealed",
  "comment_submitted",
  "reply_submitted",
  "bookmark_created",
  "story_shared",
  "report_submitted",
  "perspective_explored",
] as const;
export type EventName = (typeof EVENTS)[number];

/** Only these property keys are ever stored. Response values are deliberately absent. */
const ALLOWED_PROPS = new Set(["surface", "filter", "topic", "via", "sourceCount", "isReply"]);

export function pseudonym(id: string | null | undefined): string | null {
  if (!id) return null;
  const salt = process.env.ANALYTICS_SALT ?? process.env.AUTH_SECRET ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${id}`).digest("hex").slice(0, 32);
}

export async function track(name: EventName, opts: { subjectId?: string | null; storyId?: string | null; props?: Record<string, string | number | boolean> } = {}) {
  if (!EVENTS.includes(name)) return;
  const props = Object.fromEntries(Object.entries(opts.props ?? {}).filter(([k]) => ALLOWED_PROPS.has(k)));
  try {
    await db.insert(analyticsEvents).values({ name, subject: pseudonym(opts.subjectId), storyId: opts.storyId ?? null, props: Object.keys(props).length ? props : null });
  } catch (e) {
    console.error("[analytics] failed to record", name, e);
  }
}

export const ANALYTICS_RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 180);

export async function purgeOldEvents() {
  await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt, sql`now() - make_interval(days => ${ANALYTICS_RETENTION_DAYS})`));
}
