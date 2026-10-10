import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Executor, type Tx } from "@/server/db";
import { questions, sources, stories, storySources, storyVersions, topics, type FactItem, type ScaleConfig } from "@/server/db/schema";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { type Actor, isEditor } from "@/server/auth/roles";
import { nextStatus, type StoryAction, type StoryStatus } from "@/domain/storyWorkflow";
import { defaultScaleConfig } from "@/domain/scale";
import { audit } from "./audit";

// ───────────── Input schemas ─────────────

const factItem = z.object({ text: z.string().trim().min(1).max(600), sourceIds: z.array(z.string().uuid()).max(10).optional() });

export const storyContentSchema = z.object({
  headline: z.string().trim().min(8, "Headline is too short").max(160),
  briefing: z.string().trim().max(4000),
  keyFacts: z.array(factItem).max(15).default([]),
  disputedClaims: z.array(factItem).max(15).default([]),
  uncertainties: z.array(factItem).max(15).default([]),
  topicId: z.string().uuid().nullable().optional(),
  eventAt: z.coerce.date().nullable().optional(),
  editorialNotes: z.string().max(4000).nullable().optional(),
  editorialPriority: z.number().int().min(-10).max(10).optional(),
});
export type StoryContent = z.infer<typeof storyContentSchema>;

export const storyPatchSchema = storyContentSchema.partial();

export const questionSchema = z.object({
  questionText: z.string().trim().min(10, "Question is too short").max(300).refine((s) => s.endsWith("?"), "A question should end with a question mark"),
  allowUncertain: z.boolean().default(true),
  supportGrouping: z.boolean().default(true),
});

const httpsUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(2000)
  .refine((u) => {
    try {
      const p = new URL(u);
      return p.protocol === "https:" && !!p.hostname && !["localhost", "127.0.0.1"].includes(p.hostname);
    } catch {
      return false;
    }
  }, "Source links must be public https:// URLs");

export const sourceSchema = z.object({
  publisherName: z.string().trim().min(1).max(200),
  originalHeadline: z.string().trim().max(400).nullable().optional(),
  author: z.string().trim().max(200).nullable().optional(),
  sourceUrl: httpsUrl,
  sourceType: z.enum(["news_article", "primary_document", "government_data", "analysis", "other"]),
  publishedAt: z.coerce.date().nullable().optional(),
  rightsStatus: z.string().max(200).nullable().optional(),
  relationshipType: z.enum(["primary_evidence", "factual_reporting", "analysis", "contextual_background"]),
  claimsSupported: z.array(z.string().max(300)).max(20).optional(),
});

export const correctionSchema = storyPatchSchema.extend({
  correctionNote: z.string().trim().min(10, "Explain what was corrected").max(1000),
  question: questionSchema.optional(),
});

// ───────────── Helpers ─────────────

function requireEditor(actor: Actor) {
  if (!isEditor(actor)) throw forbidden("Editor access required");
}

export function slugify(s: string) {
  const base = s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60).replace(/-+$/, "");
  return `${base || "story"}-${randomBytes(3).toString("hex")}`;
}

const twoPersonRule = () => process.env.EDITORIAL_TWO_PERSON_RULE === "true";

async function lockStory(tx: Tx, id: string) {
  const [s] = await tx.select().from(stories).where(eq(stories.id, id)).for("update");
  if (!s) throw notFound("Story not found");
  return s;
}

async function currentVersionRow(ex: Executor, storyId: string, version: number) {
  const [v] = await ex.select().from(storyVersions).where(and(eq(storyVersions.storyId, storyId), eq(storyVersions.versionNumber, version)));
  if (!v) throw new Error(`Story ${storyId} is missing version ${version}`);
  return v;
}

const snapshot = (s: typeof stories.$inferSelect) => ({
  status: s.status,
  version: s.currentVersion,
  headline: s.headline,
  approvedBy: s.approvedBy,
});

function transition(from: StoryStatus, action: StoryAction): StoryStatus {
  try {
    return nextStatus(from, action);
  } catch (e) {
    throw conflict((e as Error).message, "invalid_transition");
  }
}

/** Copies source links from one version to the next so the evidence trail carries forward. */
async function carrySources(tx: Tx, storyId: string, from: number, to: number) {
  await tx.execute(sql`
    INSERT INTO story_sources (story_id, source_id, story_version, relationship_type, claims_supported)
    SELECT story_id, source_id, ${to}, relationship_type, claims_supported FROM story_sources
    WHERE story_id = ${storyId} AND story_version = ${from}
    ON CONFLICT DO NOTHING`);
}

// ───────────── Commands ─────────────

export async function createStory(actor: Actor, input: StoryContent) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const [s] = await tx
      .insert(stories)
      .values({
        slug: slugify(input.headline),
        headline: input.headline,
        briefing: input.briefing,
        keyFacts: input.keyFacts,
        disputedClaims: input.disputedClaims,
        uncertainties: input.uncertainties,
        topicId: input.topicId ?? null,
        eventAt: input.eventAt ?? null,
        editorialPriority: input.editorialPriority ?? 0,
        status: "draft",
        currentVersion: 1,
        createdBy: actor.id,
      })
      .returning();
    await tx.insert(storyVersions).values({
      storyId: s.id,
      versionNumber: 1,
      headline: s.headline,
      briefing: s.briefing,
      keyFacts: s.keyFacts,
      disputedClaims: s.disputedClaims,
      uncertainties: s.uncertainties,
      editorialNotes: input.editorialNotes ?? null,
      createdBy: actor.id,
    });
    await audit(tx, actor.id, "story.create", "story", s.id, null, snapshot(s));
    return s;
  });
}

/**
 * Edits unpublished content. Any edit invalidates a prior approval and returns
 * the story to draft. Published stories change only through `correctStory`.
 */
export async function updateStory(actor: Actor, id: string, patch: z.infer<typeof storyPatchSchema>) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    if (s.status === "published") throw conflict("Published stories can only be changed through a correction", "use_correction");
    if (s.status === "archived") throw conflict("Restore the story before editing it", "archived");
    const status = transition(s.status, "edit");
    const v = await currentVersionRow(tx, id, s.currentVersion);
    const content = {
      headline: patch.headline ?? s.headline,
      briefing: patch.briefing ?? s.briefing,
      keyFacts: patch.keyFacts ?? s.keyFacts,
      disputedClaims: patch.disputedClaims ?? s.disputedClaims,
      uncertainties: patch.uncertainties ?? s.uncertainties,
    };
    let version = s.currentVersion;
    if (v.publishedAt) {
      // Previously published (now unpublished) content stays on record; edits start a new version.
      version = s.currentVersion + 1;
      await tx.insert(storyVersions).values({ storyId: id, versionNumber: version, ...content, editorialNotes: patch.editorialNotes ?? v.editorialNotes, createdBy: actor.id });
      await carrySources(tx, id, s.currentVersion, version);
    } else {
      await tx
        .update(storyVersions)
        .set({ ...content, editorialNotes: patch.editorialNotes === undefined ? v.editorialNotes : patch.editorialNotes, approvedBy: null, approvedAt: null })
        .where(eq(storyVersions.id, v.id));
    }
    const [updated] = await tx
      .update(stories)
      .set({
        ...content,
        topicId: patch.topicId === undefined ? s.topicId : patch.topicId,
        eventAt: patch.eventAt === undefined ? s.eventAt : patch.eventAt,
        editorialPriority: patch.editorialPriority ?? s.editorialPriority,
        currentVersion: version,
        status,
        approvedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, id))
      .returning();
    await audit(tx, actor.id, "story.edit", "story", id, snapshot(s), snapshot(updated));
    return updated;
  });
}

/** Sets the draft question. Published questions are never edited; a revision becomes a new version. */
export async function setQuestion(actor: Actor, storyId: string, input: z.infer<typeof questionSchema>) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, storyId);
    if (s.status === "archived") throw conflict("Restore the story before editing it", "archived");
    const config: ScaleConfig = defaultScaleConfig({ allowUncertain: input.allowUncertain, supportGrouping: input.supportGrouping });
    const [latest] = await tx.select().from(questions).where(eq(questions.storyId, storyId)).orderBy(desc(questions.version)).limit(1);
    let q;
    if (latest && latest.status === "draft") {
      [q] = await tx.update(questions).set({ questionText: input.questionText, scaleConfig: config }).where(eq(questions.id, latest.id)).returning();
    } else {
      [q] = await tx
        .insert(questions)
        .values({ storyId, questionText: input.questionText, questionType: "seven_point_scale", scaleConfig: config, version: (latest?.version ?? 0) + 1, status: "draft" })
        .returning();
    }
    // A new question on an unpublished story needs re-approval like any other edit.
    if (s.status !== "published" && s.status !== "draft") {
      await tx.update(stories).set({ status: "draft", approvedBy: null, updatedAt: new Date() }).where(eq(stories.id, storyId));
      await tx.update(storyVersions).set({ approvedBy: null, approvedAt: null }).where(and(eq(storyVersions.storyId, storyId), eq(storyVersions.versionNumber, s.currentVersion), sql`${storyVersions.publishedAt} IS NULL`));
    }
    await audit(tx, actor.id, "question.set", "question", q.id, latest ? { id: latest.id, version: latest.version, text: latest.questionText } : null, { version: q.version, text: q.questionText });
    return q;
  });
}

export async function attachSource(actor: Actor, storyId: string, input: z.infer<typeof sourceSchema>) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, storyId);
    if (s.status === "archived") throw conflict("Restore the story before editing it", "archived");
    const [src] = await tx
      .insert(sources)
      .values({
        publisherName: input.publisherName,
        originalHeadline: input.originalHeadline ?? null,
        author: input.author ?? null,
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType,
        publishedAt: input.publishedAt ?? null,
        retrievedAt: new Date(),
        rightsStatus: input.rightsStatus ?? "link_only",
      })
      .returning();
    await tx.insert(storySources).values({ storyId, sourceId: src.id, storyVersion: s.currentVersion, relationshipType: input.relationshipType, claimsSupported: input.claimsSupported ?? null });
    await audit(tx, actor.id, s.status === "published" ? "source.add_post_publication" : "source.attach", "story", storyId, null, { sourceId: src.id, publisher: src.publisherName, url: src.sourceUrl, version: s.currentVersion });
    return src;
  });
}

export async function detachSource(actor: Actor, storyId: string, sourceId: string) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, storyId);
    if (s.status === "published") throw conflict("Sources on a published story can only be removed through a correction", "use_correction");
    await tx.delete(storySources).where(and(eq(storySources.storyId, storyId), eq(storySources.sourceId, sourceId), eq(storySources.storyVersion, s.currentVersion)));
    await audit(tx, actor.id, "source.detach", "story", storyId, { sourceId }, null);
  });
}

/** What must be true before a story can go to review or be published. */
export async function readinessProblems(ex: Executor, storyId: string): Promise<string[]> {
  const [s] = await ex.select().from(stories).where(eq(stories.id, storyId));
  if (!s) return ["Story not found"];
  const problems: string[] = [];
  if (!s.topicId) problems.push("Choose a topic");
  if (s.briefing.trim().split(/\s+/).length < 40) problems.push("Briefing should be at least 40 words");
  const links = await ex.select({ id: storySources.sourceId }).from(storySources).where(and(eq(storySources.storyId, storyId), eq(storySources.storyVersion, s.currentVersion)));
  if (!links.length) problems.push("Attach at least one source");
  const qs = await ex.select().from(questions).where(and(eq(questions.storyId, storyId), ne(questions.status, "retired")));
  if (!qs.length) problems.push("Add a rating question");
  return problems;
}

export async function submitForReview(actor: Actor, id: string) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    const status = transition(s.status, "submit_review");
    const problems = await readinessProblems(tx, id);
    if (problems.length) throw badRequest(`Not ready for review: ${problems.join("; ")}`, "not_ready");
    const [u] = await tx.update(stories).set({ status, updatedAt: new Date() }).where(eq(stories.id, id)).returning();
    await audit(tx, actor.id, "story.submit_review", "story", id, snapshot(s), snapshot(u));
    return u;
  });
}

/** Human approval. The approver's identity and time are stored on the story and on the version. */
export async function approveStory(actor: Actor, id: string) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    const status = transition(s.status, "approve");
    const v = await currentVersionRow(tx, id, s.currentVersion);
    if (twoPersonRule() && v.createdBy === actor.id) throw forbidden("Another editor must approve a story you drafted");
    const problems = await readinessProblems(tx, id);
    if (problems.length) throw badRequest(`Not ready to approve: ${problems.join("; ")}`, "not_ready");
    const now = new Date();
    await tx.update(storyVersions).set({ approvedBy: actor.id, approvedAt: now }).where(eq(storyVersions.id, v.id));
    const [u] = await tx.update(stories).set({ status, approvedBy: actor.id, updatedAt: now }).where(eq(stories.id, id)).returning();
    await audit(tx, actor.id, "story.approve", "story", id, snapshot(s), { ...snapshot(u), approvedAt: now.toISOString(), aiDraftPresent: !!v.aiDraft });
    return u;
  });
}

export async function requestChanges(actor: Actor, id: string, note: string) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    const status = transition(s.status, "request_changes");
    await tx.update(storyVersions).set({ approvedBy: null, approvedAt: null }).where(and(eq(storyVersions.storyId, id), eq(storyVersions.versionNumber, s.currentVersion), sql`${storyVersions.publishedAt} IS NULL`));
    const [u] = await tx.update(stories).set({ status, approvedBy: null, updatedAt: new Date() }).where(eq(stories.id, id)).returning();
    await audit(tx, actor.id, "story.request_changes", "story", id, snapshot(s), { ...snapshot(u), note: note.slice(0, 1000) });
    return u;
  });
}

/** Publishes the newest draft question (if any) and retires older live versions. */
async function publishPendingQuestion(tx: Tx, storyId: string, now: Date) {
  const [draft] = await tx.select().from(questions).where(and(eq(questions.storyId, storyId), eq(questions.status, "draft"))).orderBy(desc(questions.version)).limit(1);
  if (!draft) return null;
  await tx.update(questions).set({ status: "retired", retiredAt: now }).where(and(eq(questions.storyId, storyId), eq(questions.status, "published")));
  const [q] = await tx.update(questions).set({ status: "published", publishedAt: now }).where(eq(questions.id, draft.id)).returning();
  return q;
}

export async function publishStory(actor: Actor, id: string) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    const status = transition(s.status, "publish");
    const v = await currentVersionRow(tx, id, s.currentVersion);
    if (!s.approvedBy || !v.approvedBy || !v.approvedAt) throw forbidden("Only an approved story can be published");
    const problems = await readinessProblems(tx, id);
    if (problems.length) throw badRequest(`Not ready to publish: ${problems.join("; ")}`, "not_ready");
    const now = new Date();
    const q = await publishPendingQuestion(tx, id, now);
    const [live] = await tx.select({ id: questions.id }).from(questions).where(and(eq(questions.storyId, id), eq(questions.status, "published")));
    if (!q && !live) throw badRequest("A published question is required", "not_ready");
    if (!v.publishedAt) await tx.update(storyVersions).set({ publishedAt: now }).where(eq(storyVersions.id, v.id));
    const [u] = await tx.update(stories).set({ status, publishedAt: s.publishedAt ?? now, updatedAt: now }).where(eq(stories.id, id)).returning();
    await audit(tx, actor.id, "story.publish", "story", id, snapshot(s), { ...snapshot(u), questionVersion: q?.version ?? null });
    return u;
  });
}

/**
 * Corrects a live story. The editor making the correction is the approving
 * human; a new immutable version is created and its public correction note
 * is shown on the sources page. A revised question becomes a new question
 * version so existing results keep their original meaning.
 */
export async function correctStory(actor: Actor, id: string, input: z.infer<typeof correctionSchema>) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    transition(s.status, "correct");
    const now = new Date();
    const version = s.currentVersion + 1;
    const content = {
      headline: input.headline ?? s.headline,
      briefing: input.briefing ?? s.briefing,
      keyFacts: input.keyFacts ?? s.keyFacts,
      disputedClaims: input.disputedClaims ?? s.disputedClaims,
      uncertainties: input.uncertainties ?? s.uncertainties,
    };
    await tx.insert(storyVersions).values({
      storyId: id,
      versionNumber: version,
      ...content,
      editorialNotes: input.editorialNotes ?? null,
      correctionNote: input.correctionNote,
      createdBy: actor.id,
      approvedBy: actor.id,
      approvedAt: now,
      publishedAt: now,
    });
    await carrySources(tx, id, s.currentVersion, version);
    let newQuestion = null;
    if (input.question) {
      const [latest] = await tx.select({ version: max(questions.version) }).from(questions).where(eq(questions.storyId, id));
      // Discard any unpublished draft question; the correction's question replaces it.
      await tx.delete(questions).where(and(eq(questions.storyId, id), eq(questions.status, "draft")));
      const [maxAfter] = await tx.select({ version: max(questions.version) }).from(questions).where(eq(questions.storyId, id));
      await tx.insert(questions).values({
        storyId: id,
        questionText: input.question.questionText,
        scaleConfig: defaultScaleConfig({ allowUncertain: input.question.allowUncertain, supportGrouping: input.question.supportGrouping }),
        version: Math.max(latest?.version ?? 0, maxAfter?.version ?? 0) + 1,
        status: "draft",
      });
      newQuestion = await publishPendingQuestion(tx, id, now);
    }
    const [u] = await tx
      .update(stories)
      .set({ ...content, topicId: input.topicId === undefined ? s.topicId : input.topicId, currentVersion: version, approvedBy: actor.id, updatedAt: now })
      .where(eq(stories.id, id))
      .returning();
    await audit(tx, actor.id, "story.correct", "story", id, snapshot(s), { ...snapshot(u), correctionNote: input.correctionNote, newQuestionVersion: newQuestion?.version ?? null });
    return u;
  });
}

async function simpleTransition(actor: Actor, id: string, action: "unpublish" | "archive" | "restore") {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    const status = transition(s.status, action);
    const now = new Date();
    const patch: Partial<typeof stories.$inferInsert> = { status, updatedAt: now };
    if (action === "archive") patch.archivedAt = now;
    if (action === "restore") {
      patch.archivedAt = null;
      patch.approvedBy = null;
    }
    const [u] = await tx.update(stories).set(patch).where(eq(stories.id, id)).returning();
    await audit(tx, actor.id, `story.${action}`, "story", id, snapshot(s), snapshot(u));
    return u;
  });
}
export const unpublishStory = (a: Actor, id: string) => simpleTransition(a, id, "unpublish");
export const archiveStory = (a: Actor, id: string) => simpleTransition(a, id, "archive");
export const restoreStory = (a: Actor, id: string) => simpleTransition(a, id, "restore");

export async function saveAiDraft(actor: Actor, id: string, draft: Record<string, unknown>) {
  requireEditor(actor);
  return db.transaction(async (tx) => {
    const s = await lockStory(tx, id);
    if (s.status === "published") throw conflict("AI drafts can't be attached to a published version; start a correction instead", "use_correction");
    if (s.status === "archived") throw conflict("Restore the story before editing it", "archived");
    const v = await currentVersionRow(tx, id, s.currentVersion);
    if (v.publishedAt) throw conflict("Edit the story first to start a new draft version", "published_version");
    await tx.update(storyVersions).set({ aiDraft: { ...draft, generatedAt: new Date().toISOString(), generatedFor: actor.id } }).where(eq(storyVersions.id, v.id));
    await audit(tx, actor.id, "story.ai_draft", "story", id, null, { version: s.currentVersion, model: draft.model ?? null });
  });
}

// ───────────── Editorial reads ─────────────

export async function listForEditors(status?: StoryStatus) {
  const rows = await db
    .select({ story: stories, topic: topics.name })
    .from(stories)
    .leftJoin(topics, eq(topics.id, stories.topicId))
    .where(status ? eq(stories.status, status) : undefined)
    .orderBy(desc(stories.updatedAt))
    .limit(200);
  return rows;
}

export async function getForEditor(id: string) {
  const [row] = await db.select({ story: stories, topic: topics }).from(stories).leftJoin(topics, eq(topics.id, stories.topicId)).where(eq(stories.id, id));
  if (!row) throw notFound("Story not found");
  const versions = await db.select().from(storyVersions).where(eq(storyVersions.storyId, id)).orderBy(asc(storyVersions.versionNumber));
  const qs = await db.select().from(questions).where(eq(questions.storyId, id)).orderBy(asc(questions.version));
  const links = await db
    .select({ source: sources, link: storySources })
    .from(storySources)
    .innerJoin(sources, eq(sources.id, storySources.sourceId))
    .where(and(eq(storySources.storyId, id), eq(storySources.storyVersion, row.story.currentVersion)));
  const problems = await readinessProblems(db, id);
  return { ...row, versions, questions: qs, sources: links, problems };
}

export async function storyIdsBySlug(slugs: string[]) {
  if (!slugs.length) return [];
  return db.select({ id: stories.id, slug: stories.slug }).from(stories).where(inArray(stories.slug, slugs));
}
