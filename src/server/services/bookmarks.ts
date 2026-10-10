import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { bookmarks, stories, topics } from "@/server/db/schema";
import { notFound } from "@/lib/errors";
import type { Actor } from "@/server/auth/roles";
import { summarize } from "./reader";

export async function addBookmark(actor: Actor, storyId: string) {
  const [s] = await db.select({ status: stories.status }).from(stories).where(eq(stories.id, storyId));
  if (!s || s.status !== "published") throw notFound("Story not found");
  const r = await db.insert(bookmarks).values({ userId: actor.id, storyId }).onConflictDoNothing().returning();
  return { created: r.length > 0 };
}

export async function removeBookmark(actor: Actor, storyId: string) {
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.storyId, storyId)));
}

export async function listBookmarks(actor: Actor) {
  const rows = await db
    .select({ s: stories, topicName: topics.name, savedAt: bookmarks.createdAt })
    .from(bookmarks)
    .innerJoin(stories, eq(stories.id, bookmarks.storyId))
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(and(eq(bookmarks.userId, actor.id), eq(stories.status, "published")))
    .orderBy(desc(bookmarks.createdAt));
  return rows.map((r) => ({ id: r.s.id, slug: r.s.slug, headline: r.s.headline, summary: summarize(r.s.briefing, 120), topicName: r.topicName, savedAt: r.savedAt.toISOString() }));
}
