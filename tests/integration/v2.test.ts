import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/server/db";
import { emailOutbox, notifications, stories, storyVersions, userPreferences } from "@/server/db/schema";
import * as editorial from "@/server/services/editorial";
import { getPerspectives, getSources } from "@/server/services/reader";
import { submitRating, updateRating } from "@/server/services/ratings";
import { changeStats, ideologyBreakdown, stateBreakdown, storyBreakdowns } from "@/server/services/breakdowns";
import { completeOnboarding, updatePreferences } from "@/server/services/identity";
import { createComment } from "@/server/services/community";
import { listNotifications, markRead, queueDigests, sendPendingEmails, unreadCount } from "@/server/services/notifications";
import { upsertPublisher } from "@/server/services/publishers";
import { addCandidate, candidateClusters, promoteCluster } from "@/server/services/ingestion";
import { weeklySummary } from "@/server/services/summary";
import { BRIEFING, makeUser, publishedStory, resetDb, topicId } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

const LEFT = { side: "left" as const, summary: "Supporters say roads are a shared public good.", arguments: [{ text: "Deferred maintenance costs more later." }], framing: "Investment", values: ["fairness"] };
const RIGHT = { side: "right" as const, summary: "Opponents say the city should cut elsewhere first.", arguments: [{ text: "Sales taxes are regressive." }], framing: "Tax hike", values: ["thrift"] };

describe("left/right perspectives", () => {
  it("must cover both sides, are versioned, and are hidden until rating", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const s = await editorial.createStory(editor, { headline: "City asks voters about a road tax", briefing: BRIEFING, topicId: await topicId(), perspectives: [LEFT] });
    await editorial.attachSource(editor, s.id, { publisherName: "Wire", sourceUrl: "https://wire.example/a", sourceType: "news_article", relationshipType: "factual_reporting" });
    await editorial.setQuestion(editor, s.id, { questionText: "Do you support the proposed road tax?", allowUncertain: true, supportGrouping: true });
    await expect(editorial.submitForReview(editor, s.id)).rejects.toMatchObject({ status: 400 });
    await editorial.updateStory(editor, s.id, { perspectives: [LEFT, RIGHT] });
    await editorial.submitForReview(editor, s.id);
    await editorial.approveStory(editor, s.id);
    await editorial.publishStory(editor, s.id);
    await expect(getPerspectives(s.id, user)).rejects.toMatchObject({ status: 403 });
    const [q] = (await editorial.getForEditor(s.id)).questions;
    await submitRating(user, q.id, { questionVersion: 1, response: { type: "scale", value: 5 } });
    const p = await getPerspectives(s.id, user);
    expect(p.perspectives.map((x) => x.side)).toEqual(["left", "right"]);
    // Corrections version perspectives; the published v1 stays immutable.
    await editorial.correctStory(editor, s.id, { correctionNote: "Clarified the right-leaning argument.", perspectives: [LEFT, { ...RIGHT, summary: "Opponents prefer spending cuts to a new tax." }] });
    const [v1] = await db.select().from(storyVersions).where(eq(storyVersions.storyId, s.id)).orderBy(storyVersions.versionNumber);
    expect(v1.perspectives[1].summary).toBe(RIGHT.summary);
    await expect(db.update(storyVersions).set({ perspectives: [] }).where(eq(storyVersions.id, v1.id))).rejects.toThrow();
    expect((await getPerspectives(s.id, user)).perspectives[1].summary).toContain("spending cuts");
  });
});

describe("publishers and coverage balance", () => {
  it("matches sources to outlets by domain and reports lean coverage", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    await upsertPublisher(editor, { name: "Left Daily", domain: "leftdaily.example", lean: "lean_left", leanBasis: "Editorial assessment 2026" });
    await expect(upsertPublisher(editor, { name: "No Basis", lean: "right" })).rejects.toMatchObject({ status: 400 });
    await expect(upsertPublisher(user, { name: "X", lean: "unrated" })).rejects.toMatchObject({ status: 403 });
    const { story, questionId } = await publishedStory(editor);
    await editorial.attachSource(editor, story.id, { publisherName: "Left Daily (renamed)", sourceUrl: "https://www.leftdaily.example/x", sourceType: "news_article", relationshipType: "analysis" });
    await submitRating(user, questionId, { questionVersion: 1, response: { type: "scale", value: 4 } });
    const src = await getSources(story.id, user);
    expect(src.coverage.counts).toMatchObject({ left: 1, unrated: 1 });
    expect(src.sources.find((x) => x.lean === "lean_left")?.leanBasis).toBe("Editorial assessment 2026");
    expect((await editorial.getForEditor(story.id)).warnings.join(" ")).toMatch(/lean only left/);
  });
});

describe("breakdowns", () => {
  it("only counts consenting users and hides groups below the threshold", async () => {
    process.env.IDEOLOGY_RESULTS_THRESHOLD = "3";
    process.env.STATE_RESULTS_THRESHOLD = "2";
    try {
      const editor = await makeUser("editor");
      const { story, questionId } = await publishedStory(editor);
      const voters: [string, string, number][] = [
        ["liberal", "CA", 7], ["very liberal", "CA", 6], ["liberal", "NY", 6],
        ["conservative", "TX", 1], ["very conservative", "TX", 2],
        ["moderate", "OH", 4],
      ];
      let last;
      for (const [id, state, v] of voters) {
        last = await makeUser();
        await completeOnboarding(last.id, { topics: [], demographicsConsent: true, demographics: { politicalSelfIdentification: id as never, stateCode: state as never } });
        await submitRating(last, questionId, { questionVersion: 1, response: { type: "scale", value: v } });
      }
      // A non-consenting conservative is never counted.
      const nc = await makeUser();
      await completeOnboarding(nc.id, { topics: [], demographicsConsent: false, demographics: { politicalSelfIdentification: "conservative" } });
      await submitRating(nc, questionId, { questionVersion: 1, response: { type: "scale", value: 1 } });

      const ideo = await ideologyBreakdown(questionId);
      const left = ideo.groups.find((g) => g.key === "left")!;
      expect(left.available && left.distribution.validCount).toBe(3);
      expect(ideo.groups.find((g) => g.key === "right")!.available).toBe(false); // 2 < 3
      expect(ideo.groups.find((g) => g.key === "center")!.available).toBe(false);
      expect(ideo.gap).toBeNull();
      expect(JSON.stringify(ideo)).not.toMatch(/"validCount":2/);

      const states = await stateBreakdown(questionId);
      expect(states.groups.map((g) => g.key)).toEqual(["CA", "TX"]);

      const all = await storyBreakdowns(story.id, last!);
      expect(all.question).toBeTruthy();
      await expect(storyBreakdowns(story.id, await makeUser())).rejects.toMatchObject({ status: 403 });
    } finally {
      delete process.env.IDEOLOGY_RESULTS_THRESHOLD;
      delete process.env.STATE_RESULTS_THRESHOLD;
    }
  });

  it("tracks opinion change in aggregate", async () => {
    const editor = await makeUser("editor");
    const { questionId } = await publishedStory(editor);
    const a = await makeUser(), b = await makeUser(), c = await makeUser();
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 2 } });
    await updateRating(a, questionId, { response: { type: "scale", value: 5 } });
    await submitRating(b, questionId, { questionVersion: 1, response: { type: "uncertain" } });
    await updateRating(b, questionId, { response: { type: "scale", value: 3 } });
    await submitRating(c, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } });
    expect(await changeStats(questionId)).toEqual({ respondents: 3, changed: 2, towardSupport: 1, towardOppose: 0, becameUncertain: 0, resolvedUncertain: 1 });
  });
});

describe("notifications, digests and summaries", () => {
  it("notifies topic followers, reply targets and moderated users; digests skip without a provider", async () => {
    const editor = await makeUser("editor");
    const follower = await makeUser();
    const other = await makeUser();
    await updatePreferences(follower.id, { topics: ["economy"], notificationFrequency: "daily" });
    const { story, questionId } = await publishedStory(editor);
    let mine = await listNotifications(follower);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: "new_story", link: `/stories/${story.slug}` });
    expect(await listNotifications(other)).toHaveLength(0);

    await submitRating(follower, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } });
    await submitRating(other, questionId, { questionVersion: 1, response: { type: "scale", value: 2 } });
    const root = await createComment(follower, questionId, { body: "Roads matter for everyone here." });
    await createComment(other, questionId, { body: "But the tax is regressive for renters.", parentId: root.id });
    mine = await listNotifications(follower);
    expect(mine.map((n) => n.kind)).toContain("comment_reply");
    expect(await unreadCount(follower.id)).toBe(2);

    expect(await queueDigests(new Date())).toBe(1);
    expect(await sendPendingEmails()).toBe(1);
    const [mail] = await db.select().from(emailOutbox);
    expect(mail.status).toBe("skipped");
    expect(mail.text).toContain(story.headline);
    expect(await queueDigests(new Date())).toBe(0); // once per period

    await markRead(follower);
    expect(await unreadCount(follower.id)).toBe(0);

    const summary = await weeklySummary(follower.id);
    expect(summary.answered).toBe(1);
    expect(summary.items[0].sameSidePercent).toBe(50);
  });
});

describe("scheduling and clustering", () => {
  it("publishes scheduled stories when due; edits cancel the schedule", async () => {
    const editor = await makeUser("editor");
    const s = await editorial.createStory(editor, { headline: "Scheduled story about transit funding", briefing: BRIEFING, topicId: await topicId() });
    await editorial.attachSource(editor, s.id, { publisherName: "Wire", sourceUrl: "https://wire.example/t", sourceType: "news_article", relationshipType: "factual_reporting" });
    await editorial.setQuestion(editor, s.id, { questionText: "Do you support more transit funding?", allowUncertain: true, supportGrouping: true });
    await expect(editorial.schedulePublish(editor, s.id, new Date(Date.now() + 3600_000))).rejects.toMatchObject({ status: 409 });
    await editorial.submitForReview(editor, s.id);
    await editorial.approveStory(editor, s.id);
    const at = new Date(Date.now() + 3600_000);
    await editorial.schedulePublish(editor, s.id, at);
    expect(await editorial.publishDueStories(new Date())).toEqual([]);
    expect(await editorial.publishDueStories(new Date(at.getTime() + 1000))).toEqual([s.id]);
    const [p] = await db.select().from(stories).where(eq(stories.id, s.id));
    expect(p.status).toBe("published");
    expect(p.scheduledPublishAt).toBeNull();
  });

  it("clusters candidates across outlets and promotes a cluster with all sources", async () => {
    const editor = await makeUser("editor");
    await upsertPublisher(editor, { name: "Right Wire", domain: "rightwire.example", lean: "right", leanBasis: "test" });
    await addCandidate({ title: "Senate passes infrastructure funding bill after long debate", url: "https://leftdaily.example/a", publisherName: "Left Daily" });
    await addCandidate({ title: "Infrastructure funding bill passes Senate after debate", url: "https://rightwire.example/b", publisherName: "Right Wire" });
    await addCandidate({ title: "Court rules on state immigration law", url: "https://other.example/c", publisherName: "Other" });
    const clusters = await candidateClusters(editor);
    const big = clusters[0];
    expect(big.items).toHaveLength(2);
    expect(big.mix.right).toBe(1);
    const story = await promoteCluster(editor, big.items.map((i) => i.id));
    expect((await editorial.getForEditor(story.id)).sources).toHaveLength(2);
    expect((await candidateClusters(editor))).toHaveLength(1);
  });
});
