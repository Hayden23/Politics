import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { candidateStories, contentReports, sources, storySources, stories } from "@/server/db/schema";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { type Actor, isEditor } from "@/server/auth/roles";
import { attachSource, createStory } from "./editorial";
import { audit } from "./audit";

/** Strips tracking parameters and fragments so the same article dedupes across feeds. */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|cmpid|smid)/i.test(k)) u.searchParams.delete(k);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.protocol = "https:";
  return u.toString().replace(/\/$/, "");
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3));

/** Jaccard similarity of significant words — cheap near-duplicate detection across outlets. */
export function titleSimilarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const candidateSchema = z.object({
  title: z.string().trim().min(5).max(400),
  url: z.string().trim().url().max(2000),
  publisherName: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(2000).optional(),
});

export async function addCandidate(input: z.infer<typeof candidateSchema> & { feedName?: string; publishedAt?: Date | null }) {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(input.url);
  } catch {
    return null;
  }
  const recent = await db
    .select({ id: candidateStories.id, title: candidateStories.title })
    .from(candidateStories)
    .where(sql`${candidateStories.createdAt} > now() - interval '3 days'`)
    .orderBy(desc(candidateStories.createdAt))
    .limit(500);
  const dupe = recent.find((r) => titleSimilarity(r.title, input.title) >= 0.6);
  const [row] = await db
    .insert(candidateStories)
    .values({
      title: input.title,
      url: input.url,
      normalizedUrl,
      publisherName: input.publisherName ?? null,
      summary: input.summary?.slice(0, 2000) ?? null,
      feedName: input.feedName ?? "manual",
      publishedAt: input.publishedAt ?? null,
      duplicateOf: dupe?.id ?? null,
    })
    .onConflictDoNothing({ target: candidateStories.normalizedUrl })
    .returning();
  return row ?? null;
}

export async function listCandidates(actor: Actor, status: "new" | "promoted" | "dismissed" = "new") {
  if (!isEditor(actor)) throw forbidden("Editor access required");
  return db.select().from(candidateStories).where(eq(candidateStories.status, status)).orderBy(desc(candidateStories.createdAt)).limit(200);
}

export async function dismissCandidate(actor: Actor, id: string) {
  if (!isEditor(actor)) throw forbidden("Editor access required");
  await db.update(candidateStories).set({ status: "dismissed" }).where(eq(candidateStories.id, id));
}

/**
 * Turns a lead into a draft. The publisher's headline is stored only on the
 * source record; the draft starts with a placeholder headline the editor
 * must rewrite in source-blind form.
 */
export async function promoteCandidate(actor: Actor, id: string) {
  if (!isEditor(actor)) throw forbidden("Editor access required");
  const [c] = await db.select().from(candidateStories).where(eq(candidateStories.id, id));
  if (!c) throw notFound("Candidate not found");
  if (c.status === "promoted" && c.storyId) throw conflict("Already promoted", "promoted");
  const story = await createStory(actor, { headline: "Untitled draft — write a source-blind headline", briefing: "", keyFacts: [], disputedClaims: [], uncertainties: [], editorialNotes: `Promoted from candidate: ${c.title}\n${c.summary ?? ""}`.trim() });
  let publisher = c.publisherName;
  try {
    publisher ??= new URL(c.url).hostname.replace(/^www\./, "");
  } catch {}
  if (c.url.startsWith("https://")) {
    await attachSource(actor, story.id, { publisherName: publisher ?? "Unknown", originalHeadline: c.title, sourceUrl: c.url, sourceType: "news_article", relationshipType: "factual_reporting", publishedAt: c.publishedAt });
  }
  await db.update(candidateStories).set({ status: "promoted", storyId: story.id }).where(eq(candidateStories.id, id));
  return story;
}

// ───────────── RSS connector ─────────────

/** INGEST_FEEDS="Name|https://example.com/feed.xml,Other|https://…" — headline/link metadata only. */
export function configuredFeeds(): { name: string; url: string }[] {
  return (process.env.INGEST_FEEDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, url] = s.includes("|") ? s.split("|") : [new URL(s).hostname, s];
      return { name: name.trim(), url: url.trim() };
    });
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

export function parseFeed(xml: string): { title: string; url: string; summary?: string; publishedAt?: Date }[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/g) ?? [];
  return items
    .map((it) => {
      const tag = (t: string) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1];
      const link = tag("link") ? decode(tag("link")!) : it.match(/<link[^>]*href="([^"]+)"/)?.[1];
      const date = tag("pubDate") ?? tag("published") ?? tag("updated");
      return { title: decode(tag("title") ?? ""), url: link ?? "", summary: tag("description") ? decode(tag("description")!).slice(0, 500) : undefined, publishedAt: date ? new Date(decode(date)) : undefined };
    })
    .filter((i) => i.title && /^https?:\/\//.test(i.url));
}

export async function ingestFeeds() {
  let added = 0;
  for (const feed of configuredFeeds()) {
    try {
      const res = await fetch(feed.url, { headers: { "user-agent": "CivicLensBot/1.0 (+editorial candidate discovery)" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const item of parseFeed(await res.text()).slice(0, 50)) {
        const row = await addCandidate({ title: item.title, url: item.url, summary: item.summary, publisherName: feed.name, feedName: feed.name, publishedAt: item.publishedAt && !isNaN(+item.publishedAt) ? item.publishedAt : null });
        if (row) added++;
      }
    } catch (e) {
      console.error(`[ingest] ${feed.name}: ${(e as Error).message}`);
    }
  }
  return added;
}

// ───────────── Source link monitoring ─────────────

export async function checkLink(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000) });
    return res.status < 400 || res.status === 403 || res.status === 429;
  } catch {
    return false;
  }
}

/** Re-checks sources on published stories; newly broken links open an editorial report. */
export async function checkSourceLinks(limit = 100) {
  const rows = await db
    .selectDistinct({ id: sources.id, url: sources.sourceUrl, status: sources.linkStatus, storyId: storySources.storyId })
    .from(sources)
    .innerJoin(storySources, eq(storySources.sourceId, sources.id))
    .innerJoin(stories, and(eq(stories.id, storySources.storyId), eq(stories.currentVersion, storySources.storyVersion)))
    .where(and(inArray(stories.status, ["published", "approved", "in_review"]), sql`(${sources.linkCheckedAt} IS NULL OR ${sources.linkCheckedAt} < now() - interval '1 day')`))
    .limit(limit);
  for (const r of rows) {
    const ok = await checkLink(r.url);
    await db.update(sources).set({ linkStatus: ok ? "ok" : "broken", linkCheckedAt: new Date() }).where(eq(sources.id, r.id));
    if (!ok && r.status !== "broken") {
      const [report] = await db.insert(contentReports).values({ reporterId: null, targetType: "story", targetId: r.storyId, reason: "broken_link", details: `Automated check: ${r.url} is unreachable` }).returning();
      await audit(db, null, "source.link_broken", "source", r.id, null, { url: r.url, reportId: report.id });
    }
  }
  return rows.length;
}
