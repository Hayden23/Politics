import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/server/db";
import { ratingHistory, ratings } from "@/server/db/schema";
import { myRatings, submitRating, updateRating } from "@/server/services/ratings";
import { getBriefing, getResults, getSources } from "@/server/services/reader";
import * as editorial from "@/server/services/editorial";
import { makeUser, publishedStory, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("rating submission", () => {
  it("concurrent duplicate submissions create exactly one rating", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const { questionId } = await publishedStory(editor);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => submitRating(user, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } })));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const created = results.filter((r) => r.status === "fulfilled" && r.value.created);
    expect(created).toHaveLength(1);
    const rows = await db.select().from(ratings).where(eq(ratings.questionId, questionId));
    expect(rows).toHaveLength(1);
    const h = await db.select().from(ratingHistory).where(eq(ratingHistory.ratingId, rows[0].id));
    expect(h).toHaveLength(1);
  });

  it("a different second answer is refused; updates go through PATCH and keep history", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const { questionId } = await publishedStory(editor);
    await submitRating(user, questionId, { questionVersion: 1, response: { type: "scale", value: 2 } });
    await expect(submitRating(user, questionId, { questionVersion: 1, response: { type: "scale", value: 7 } })).rejects.toMatchObject({ status: 409 });
    await updateRating(user, questionId, { response: { type: "uncertain" } });
    await updateRating(user, questionId, { response: { type: "scale", value: 5 } });
    const [mine] = await myRatings(user);
    expect(mine.original).toEqual({ type: "scale", value: 2 });
    expect(mine.current).toEqual({ type: "scale", value: 5 });
    expect(mine.changed).toBe(true);
    expect(mine.history.map((h) => h.type)).toEqual(["scale", "uncertain", "scale"]);
  });

  it("validates the scale and stale question versions", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const { questionId } = await publishedStory(editor);
    for (const bad of [{ type: "scale", value: 0 }, { type: "scale", value: 8 }, { type: "scale", value: 3.5 }, { type: "scale" }, { type: "neutral" }, { type: "uncertain", value: 4 }]) {
      await expect(submitRating(user, questionId, { questionVersion: 1, response: bad })).rejects.toMatchObject({ status: 400 });
    }
    await expect(submitRating(user, questionId, { questionVersion: 2, response: { type: "scale", value: 4 } })).rejects.toMatchObject({ status: 409 });
  });

  it("cannot rate a retired question version", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const { story, questionId } = await publishedStory(editor);
    await editorial.correctStory(editor, story.id, { correctionNote: "Question wording was revised for neutrality.", question: { questionText: "Should the city raise its sales tax to repair roads?", allowUncertain: true, supportGrouping: true } });
    await expect(submitRating(user, questionId, { questionVersion: 1, response: { type: "scale", value: 4 } })).rejects.toMatchObject({ status: 409 });
  });
});

describe("source-blind reveal", () => {
  it("hides sources and results until the user rates", async () => {
    const editor = await makeUser("editor");
    const user = await makeUser();
    const { story, questionId } = await publishedStory(editor);
    const brief = await getBriefing(story.slug, user);
    expect(JSON.stringify(brief)).not.toContain("Example Gazette");
    expect(JSON.stringify(brief)).not.toContain("Council punts");
    await expect(getResults(story.id, user)).rejects.toMatchObject({ status: 403 });
    await expect(getSources(story.id, user)).rejects.toMatchObject({ status: 403 });
    await expect(getResults(story.id, null)).rejects.toMatchObject({ status: 403 });
    await submitRating(user, questionId, { questionVersion: 1, response: { type: "uncertain" } });
    const src = await getSources(story.id, user);
    expect(src.sources[0]).toMatchObject({ publisherName: "Example Gazette", originalHeadline: "Council punts tax hike to voters" });
    const res = await getResults(story.id, user);
    expect(res.results[0].distribution).toMatchObject({ validCount: 0, uncertainCount: 1, totalCount: 1 });
  });
});

describe("results aggregation", () => {
  it("matches persisted ratings and counts uncertainty separately", async () => {
    const editor = await makeUser("editor");
    const { story, questionId } = await publishedStory(editor);
    const values = [1, 2, 2, 4, 5, 6, 6, 6, 7, null];
    let last;
    for (const v of values) {
      last = await makeUser();
      await submitRating(last, questionId, { questionVersion: 1, response: v === null ? { type: "uncertain" } : { type: "scale", value: v } });
    }
    const res = await getResults(story.id, last!);
    const d = res.results[0].distribution;
    expect(d.validCount).toBe(9);
    expect(d.uncertainCount).toBe(1);
    expect(d.buckets.map((b) => b.count)).toEqual([1, 2, 0, 1, 1, 3, 1]);
    expect(d.grouping?.oppose.count).toBe(3);
    expect(d.grouping?.neutral.count).toBe(1);
    expect(d.grouping?.support.count).toBe(5);
    expect(d.median).toBe(5);
    expect(d.smallSample).toBe(true);
    expect(res.results[0].population).toBe("Participating users' responses");
    expect(res.results[0].weighting).toBe("Unweighted");
  });
});
