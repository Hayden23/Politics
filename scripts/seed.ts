/**
 * Reference data only: the topic list. Never seeds stories, ratings or
 * comments — production content comes from the editorial workflow.
 */
import { sql } from "drizzle-orm";
import { db, closeDb } from "../src/server/db";
import { topics } from "../src/server/db/schema";
import { TOPICS } from "../src/domain/topics";

for (const t of TOPICS) {
  await db.insert(topics).values({ slug: t.slug, name: t.name }).onConflictDoUpdate({ target: topics.slug, set: { name: sql`excluded.name` } });
}
console.log(`Seeded ${TOPICS.length} topics`);
await closeDb();
