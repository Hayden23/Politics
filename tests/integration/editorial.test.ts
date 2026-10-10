import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, db } from "@/server/db";
import { editorialAuditLog, questions, stories, storyVersions } from "@/server/db/schema";
import * as editorial from "@/server/services/editorial";
import { getBriefing, listFeed } from "@/server/services/reader";
import { generateDraft } from "@/server/ai";
import { BRIEFING, makeUser, publishedStory, resetDb, topicId } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

async function draft(editorId: Awaited<ReturnType<typeof makeUser>>) {
  const s = await editorial.createStory(editorId, { headline: "State proposes new limits on facial recognition", briefing: BRIEFING, keyFacts: [], disputedClaims: [], uncertainties: [], topicId: await topicId("technology-privacy") });
  await editorial.attachSource(editorId, s.id, { publisherName: "Wire", sourceUrl: "https://example.org/a", sourceType: "news_article", relationshipType: "factual_reporting" });
  await editorial.setQuestion(editorId, s.id, { questionText: "Do you support limiting police use of facial recognition?", allowUncertain: true, supportGrouping: true });
  return s;
}

describe("editorial approval enforcement", () => {
  it("rejects publishing without approval, then publishes after approval", async () => {
    const editor = await makeUser("editor");
    const s = await draft(editor);
    await expect(editorial.publishStory(editor, s.id)).rejects.toMatchObject({ status: 409 });
    await editorial.submitForReview(editor, s.id);
    await expect(editorial.publishStory(editor, s.id)).rejects.toMatchObject({ status: 409 });
    await editorial.approveStory(editor, s.id);
    const p = await editorial.publishStory(editor, s.id);
    expect(p.status).toBe("published");
    const feed = await listFeed(null);
    expect(feed.items.map((i) => i.id)).toContain(s.id);
    const actions = (await db.select().from(editorialAuditLog).where(eq(editorialAuditLog.entityId, s.id))).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["story.create", "story.submit_review", "story.approve", "story.publish"]));
  });

  it("the database refuses a published story with no approver", async () => {
    const editor = await makeUser("editor");
    const s = await draft(editor);
    await expect(db.update(stories).set({ status: "published" }).where(eq(stories.id, s.id))).rejects.toThrow();
  });

  it("ordinary users and moderators cannot edit or publish", async () => {
    const editor = await makeUser("editor");
    const s = await draft(editor);
    for (const role of ["user", "moderator"] as const) {
      const a = await makeUser(role);
      await expect(editorial.updateStory(a, s.id, { headline: "Hijacked headline here" })).rejects.toMatchObject({ status: 403 });
      await expect(editorial.approveStory(a, s.id)).rejects.toMatchObject({ status: 403 });
    }
  });

  it("editing after approval invalidates the approval", async () => {
    const editor = await makeUser("editor");
    const s = await draft(editor);
    await editorial.submitForReview(editor, s.id);
    await editorial.approveStory(editor, s.id);
    const edited = await editorial.updateStory(editor, s.id, { headline: "State proposes new limits on face scanning" });
    expect(edited.status).toBe("draft");
    expect(edited.approvedBy).toBeNull();
    await expect(editorial.publishStory(editor, s.id)).rejects.toMatchObject({ status: 409 });
  });

  it("an AI draft cannot bypass approval", async () => {
    const editor = await makeUser("editor");
    const s = await draft(editor);
    const r = await generateDraft({ topic: "x", editorNotes: "", material: [{ ref: 1, publisher: "Wire", url: null, text: "Some long enough source material text here." }] });
    await editorial.saveAiDraft(editor, s.id, { ...r.draft });
    const [v] = await db.select().from(storyVersions).where(eq(storyVersions.storyId, s.id));
    expect(v.aiDraft).toBeTruthy();
    expect(v.approvedBy).toBeNull();
    await expect(editorial.publishStory(editor, s.id)).rejects.toMatchObject({ status: 409 });
  });

  it("enforces the two-person rule when enabled", async () => {
    process.env.EDITORIAL_TWO_PERSON_RULE = "true";
    try {
      const a = await makeUser("editor");
      const b = await makeUser("editor");
      const s = await draft(a);
      await editorial.submitForReview(a, s.id);
      await expect(editorial.approveStory(a, s.id)).rejects.toMatchObject({ status: 403 });
      await editorial.approveStory(b, s.id);
    } finally {
      delete process.env.EDITORIAL_TWO_PERSON_RULE;
    }
  });

  it("refuses review when the story is incomplete", async () => {
    const editor = await makeUser("editor");
    const s = await editorial.createStory(editor, { headline: "A short draft with nothing else", briefing: "Too short.", keyFacts: [], disputedClaims: [], uncertainties: [] });
    await expect(editorial.submitForReview(editor, s.id)).rejects.toMatchObject({ status: 400 });
  });

  it("draft, archived and unpublished stories are invisible to readers", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const s = await draft(editor);
    await expect(getBriefing(s.slug, user)).rejects.toMatchObject({ status: 404 });
    await expect(getBriefing(s.slug, null)).rejects.toMatchObject({ status: 404 });
    // Editors can preview.
    expect((await getBriefing(s.slug, editor, { preview: true })).preview).toBe(true);
    // A regular user asking for preview still gets 404.
    await expect(getBriefing(s.slug, user, { preview: true })).rejects.toMatchObject({ status: 404 });
    const { story } = await publishedStory(editor);
    await editorial.unpublishStory(editor, story.id);
    await expect(getBriefing(story.slug, user)).rejects.toMatchObject({ status: 404 });
    expect((await listFeed(user)).items).toHaveLength(0);
  });
});

describe("corrections and versioning", () => {
  it("creates a new immutable version with a public note, and a new question version", async () => {
    const editor = await makeUser("editor");
    const { story, questionId } = await publishedStory(editor);
    await expect(editorial.updateStory(editor, story.id, { headline: "Quietly changed headline" })).rejects.toMatchObject({ status: 409 });
    const c = await editorial.correctStory(editor, story.id, {
      briefing: BRIEFING.replace("half a percentage point", "0.5 percentage points"),
      correctionNote: "Clarified the size of the proposed increase.",
      question: { questionText: "Do you support a 0.5-point sales tax increase for road repairs?", allowUncertain: true, supportGrouping: true },
    });
    expect(c.currentVersion).toBe(2);
    const qs = await db.select().from(questions).where(eq(questions.storyId, story.id));
    expect(qs.find((q) => q.id === questionId)?.status).toBe("retired");
    expect(qs.find((q) => q.version === 2)?.status).toBe("published");
    // Published question text is immutable at the database level.
    await expect(db.update(questions).set({ questionText: "Changed?" }).where(eq(questions.id, questionId))).rejects.toThrow();
    // Version 1 is still on record and can't be rewritten.
    const [v1] = await db.select().from(storyVersions).where(sql`${storyVersions.storyId} = ${story.id} AND ${storyVersions.versionNumber} = 1`);
    expect(v1.briefing).toBe(BRIEFING);
    await expect(db.update(storyVersions).set({ briefing: "rewrite" }).where(eq(storyVersions.id, v1.id))).rejects.toThrow();
  });

  it("the audit log is append-only", async () => {
    const editor = await makeUser("editor");
    await publishedStory(editor);
    await expect(db.delete(editorialAuditLog)).rejects.toThrow();
  });
});
