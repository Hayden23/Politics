import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { publishers, sources } from "@/server/db/schema";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { type Actor, isEditor } from "@/server/auth/roles";
import { audit } from "./audit";

export const publisherSchema = z.object({
  name: z.string().trim().min(1).max(200),
  domain: z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like example.com").nullable().optional(),
  lean: z.enum(["left", "lean_left", "center", "lean_right", "right", "unrated"]),
  leanBasis: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function listPublishers(actor: Actor) {
  if (!isEditor(actor)) throw forbidden("Editor access required");
  return db
    .select({ p: publishers, sourceCount: sql<number>`(SELECT count(*)::int FROM sources s WHERE s.publisher_id = ${publishers.id})` })
    .from(publishers)
    .orderBy(asc(publishers.name));
}

/** A lean rating needs a stated basis so readers can see where it came from. */
export async function upsertPublisher(actor: Actor, input: z.infer<typeof publisherSchema>, id?: string) {
  if (!isEditor(actor)) throw forbidden("Editor access required");
  if (input.lean !== "unrated" && !input.leanBasis) throw badRequest("Say what the lean rating is based on");
  const values = { name: input.name, domain: input.domain ?? null, lean: input.lean, leanBasis: input.leanBasis ?? null, notes: input.notes ?? null, updatedAt: new Date() };
  if (id) {
    const [before] = await db.select().from(publishers).where(eq(publishers.id, id));
    if (!before) throw notFound("Publisher not found");
    const [u] = await db.update(publishers).set(values).where(eq(publishers.id, id)).returning();
    await audit(db, actor.id, "publisher.update", "publisher", id, { lean: before.lean, leanBasis: before.leanBasis }, { lean: u.lean, leanBasis: u.leanBasis });
    return u;
  }
  const [c] = await db.insert(publishers).values(values).returning();
  await audit(db, actor.id, "publisher.create", "publisher", c.id, null, { name: c.name, lean: c.lean });
  // Link existing sources from this domain.
  if (c.domain) await db.execute(sql`UPDATE sources SET publisher_id = ${c.id} WHERE publisher_id IS NULL AND source_url ~* ${`^https?://(www\\.)?${c.domain.replace(/\./g, "\\.")}(/|$)`}`);
  return c;
}

export async function sourcesForPublisher(id: string) {
  return db.select().from(sources).where(eq(sources.publisherId, id)).limit(50);
}
