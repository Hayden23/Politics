import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/server/db";
import { comments, contentReports, ratings, sessions, userDemographics, users } from "@/server/db/schema";
import { myRatings, submitRating } from "@/server/services/ratings";
import { createComment, editComment, deleteComment, listComments, toggleReaction, blockUser } from "@/server/services/community";
import { createReport, fileAppeal, listReports, myEnforcement, resolveAppeal, resolveReport } from "@/server/services/moderation";
import { completeOnboarding, deleteAccount, exportUserData } from "@/server/services/identity";
import { getResults } from "@/server/services/reader";
import { updatePreferences } from "@/server/services/identity";
import { makeUser, publishedStory, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("privacy", () => {
  it("one user's ratings are never visible to another", async () => {
    const editor = await makeUser("editor");
    const a = await makeUser();
    const b = await makeUser();
    const { story, questionId } = await publishedStory(editor);
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 7 } });
    expect(await myRatings(b)).toHaveLength(0);
    await submitRating(b, questionId, { questionVersion: 1, response: { type: "scale", value: 1 } });
    const res = await getResults(story.id, b);
    const text = JSON.stringify(res);
    expect(text).not.toContain(a.id);
    expect(res.myRatings).toHaveLength(1);
    expect(res.myRatings[0].value).toBe(1);
  });

  it("author ratings on comments are shown only when the author opts in", async () => {
    const editor = await makeUser("editor");
    const a = await makeUser();
    const b = await makeUser();
    const { questionId } = await publishedStory(editor);
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 7 } });
    await submitRating(b, questionId, { questionVersion: 1, response: { type: "scale", value: 1 } });
    await createComment(a, questionId, { body: "The roads in my area are in rough shape." });
    let list = await listComments(b, questionId, "all");
    expect(list.comments[0].authorRating).toBeNull();
    expect((await listComments(b, questionId, "different")).comments).toHaveLength(0);
    await updatePreferences(a.id, { showRatingOnComments: true });
    list = await listComments(b, questionId, "all");
    expect(list.comments[0].authorRating?.label).toBe("Strongly support");
    expect((await listComments(b, questionId, "different")).comments).toHaveLength(1);
  });

  it("export contains the user's data; deletion removes opinions and personal data", async () => {
    const editor = await makeUser("editor");
    const a = await makeUser();
    const { story, questionId } = await publishedStory(editor);
    await completeOnboarding(a.id, { topics: ["economy"], demographicsConsent: true, demographics: { stateCode: "OH", ageRange: "25-34" } });
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 3 } });
    await createComment(a, questionId, { body: "I think this needs a sunset clause." });
    const exp = await exportUserData(a.id);
    expect(exp.ratings).toHaveLength(1);
    expect(exp.demographics?.stateCode).toBe("OH");
    expect(exp.comments).toHaveLength(1);
    await deleteAccount(a.id);
    expect(await db.select().from(ratings).where(eq(ratings.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(userDemographics).where(eq(userDemographics.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, a.id))).toHaveLength(0);
    const [u] = await db.select().from(users).where(eq(users.id, a.id));
    expect(u).toMatchObject({ email: null, displayName: null, accountStatus: "deleted" });
    const [c] = await db.select().from(comments).where(eq(comments.userId, a.id));
    expect(c).toMatchObject({ status: "deleted", body: "[deleted]" });
    expect(story.id).toBeTruthy();
  });

  it("demographics are not stored without consent", async () => {
    const a = await makeUser();
    await completeOnboarding(a.id, { topics: [], demographicsConsent: false, demographics: { stateCode: "TX" } });
    expect(await db.select().from(userDemographics).where(eq(userDemographics.userId, a.id))).toHaveLength(0);
  });
});

describe("community", () => {
  it("requires a rating to comment; supports replies, edits, deletes and reactions", async () => {
    const editor = await makeUser("editor");
    const a = await makeUser();
    const b = await makeUser();
    const { questionId } = await publishedStory(editor);
    await expect(createComment(a, questionId, { body: "Commenting before rating should fail." })).rejects.toMatchObject({ status: 403 });
    await expect(listComments(a, questionId)).rejects.toMatchObject({ status: 403 });
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } });
    await submitRating(b, questionId, { questionVersion: 1, response: { type: "scale", value: 2 } });
    const root = await createComment(a, questionId, { body: "Road repair has been deferred for years." });
    const reply = await createComment(b, questionId, { body: "But a sales tax hits renters harder.", parentId: root.id });
    const nested = await createComment(a, questionId, { body: "Fair point — maybe pair it with a rebate.", parentId: reply.id });
    expect(reply.parentCommentId).toBe(root.id);
    expect(nested.parentCommentId).toBe(root.id);
    await toggleReaction(b, root.id);
    await expect(toggleReaction(a, root.id)).rejects.toMatchObject({ status: 400 });
    let list = await listComments(b, questionId, "insightful");
    expect(list.comments[0]).toMatchObject({ id: root.id, insightful: 1 });
    expect(list.comments[0].replies).toHaveLength(2);
    await editComment(a, root.id, "Road repair has been deferred for over a decade.");
    await expect(editComment(b, root.id, "Not my comment to edit at all.")).rejects.toMatchObject({ status: 404 });
    await deleteComment(b, reply.id);
    list = await listComments(a, questionId, "newest");
    expect(list.comments[0].replies.map((r) => r.id)).toEqual([nested.id]);
    expect(list.comments[0].edited).toBe(true);
    await blockUser(b, a.id);
    expect((await listComments(b, questionId)).comments).toHaveLength(0);
  });
});

describe("moderation", () => {
  it("reports enter the queue; only moderators resolve; actions are logged and appealable", async () => {
    const editor = await makeUser("editor");
    const mod = await makeUser("moderator");
    const mod2 = await makeUser("moderator");
    const a = await makeUser();
    const b = await makeUser();
    const { questionId } = await publishedStory(editor);
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } });
    await submitRating(b, questionId, { questionVersion: 1, response: { type: "scale", value: 2 } });
    const c = await createComment(a, questionId, { body: "Here is something a reader found abusive." });
    const r = await createReport(b, { targetType: "comment", targetId: c.id, reason: "harassment", details: "Personal attack" });
    const again = await createReport(b, { targetType: "comment", targetId: c.id, reason: "harassment" });
    expect(again.id).toBe(r.id);
    await expect(listReports(b)).rejects.toMatchObject({ status: 403 });
    const queue = await listReports(mod);
    expect(queue.map((q) => q.id)).toContain(r.id);
    await expect(resolveReport(b, r.id, { action: "remove_content", reason: "nope" })).rejects.toMatchObject({ status: 403 });
    await expect(resolveReport(editor, r.id, { action: "remove_content", reason: "editors handle stories" })).rejects.toMatchObject({ status: 403 });
    await resolveReport(mod, r.id, { action: "remove_content", reason: "Targeted harassment of another user" });
    const [after] = await db.select().from(comments).where(eq(comments.id, c.id));
    expect(after.status).toBe("removed");
    const [closed] = await db.select().from(contentReports).where(eq(contentReports.id, r.id));
    expect(closed.status).toBe("resolved");
    expect((await listComments(b, questionId)).comments).toHaveLength(0);
    const enforcement = await myEnforcement(a);
    expect(enforcement[0].action).toBe("remove_content");
    const ap = await fileAppeal(a.id, enforcement[0].id, "I was quoting someone else, not attacking anyone.");
    await expect(resolveAppeal(mod, ap.id, "overturned", "Self review")).rejects.toMatchObject({ status: 403 });
    await resolveAppeal(mod2, ap.id, "overturned", "Context shows a quotation");
    const [restored] = await db.select().from(comments).where(eq(comments.id, c.id));
    expect(restored.status).toBe("active");
  });

  it("story reports go to editors, and suspension revokes sessions", async () => {
    const editor = await makeUser("editor");
    const mod = await makeUser("moderator");
    const a = await makeUser();
    const b = await makeUser();
    const { story, questionId } = await publishedStory(editor);
    const sr = await createReport(a, { targetType: "story", targetId: story.id, reason: "factual_error" });
    expect((await listReports(editor)).map((x) => x.id)).toContain(sr.id);
    await resolveReport(editor, sr.id, { action: "resolve_editorial", reason: "Corrected the figure" });
    await submitRating(a, questionId, { questionVersion: 1, response: { type: "scale", value: 6 } });
    const c = await createComment(a, questionId, { body: "Spam spam spam visit my site please." });
    const r = await createReport(b, { targetType: "comment", targetId: c.id, reason: "spam" });
    await db.insert(sessions).values({ id: "tok", userId: a.id, expiresAt: new Date(Date.now() + 86400000) });
    await resolveReport(mod, r.id, { action: "suspend", reason: "Repeated spam" });
    const [u] = await db.select().from(users).where(eq(users.id, a.id));
    expect(u.accountStatus).toBe("suspended");
    expect(await db.select().from(sessions).where(eq(sessions.userId, a.id))).toHaveLength(0);
  });
});
