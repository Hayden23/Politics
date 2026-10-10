import { expect, test } from "@playwright/test";
import { adminContext, apiSignup, publishStory, uniqueEmail } from "./helpers";

test("D: explain, reply, report, and a moderator resolves the report", async ({ browser, baseURL }) => {
  const admin = await adminContext(baseURL!);
  const story = await publishStory(admin, { headline: "Community check: phones in school lockers" });
  const rate = (ctx: { request: import("@playwright/test").APIRequestContext }, value: number) =>
    ctx.request.post(`/api/questions/${story.questionId}/ratings`, { data: { questionVersion: 1, response: { type: "scale", value } } });

  // Author posts an explanation through the UI.
  const a = await browser.newContext({ baseURL });
  await apiSignup(a.request, uniqueEmail("da"), "Dana Author");
  await rate(a, 6);
  const pa = await a.newPage();
  await pa.goto(`/stories/${story.slug}/discussion`);
  await pa.getByLabel("What is the main reason behind your position?").fill("Phones pull attention away from lessons, and teachers spend time policing them.");
  await pa.getByRole("button", { name: "Post explanation" }).click();
  await expect(pa.getByText("Phones pull attention away from lessons")).toBeVisible();

  // A second user replies to it.
  const b = await browser.newContext({ baseURL });
  await apiSignup(b.request, uniqueEmail("db"), "Blake Replier");
  await rate(b, 2);
  const pb = await b.newPage();
  await pb.goto(`/stories/${story.slug}/discussion?perspective=newest`);
  const card = pb.getByRole("article", { name: "Comment by Dana Author" });
  await card.getByRole("button", { name: "Reply" }).click();
  await pb.getByLabel("Reply to Dana Author").fill("Parents need a way to reach kids during emergencies, though.");
  await pb.getByRole("button", { name: "Post reply" }).click();
  await expect(pb.getByText("Parents need a way to reach kids")).toBeVisible();

  // A third user reports the explanation.
  const c = await browser.newContext({ baseURL });
  await apiSignup(c.request, uniqueEmail("dc"), "Casey Reporter");
  await rate(c, 4);
  const pc = await c.newPage();
  await pc.goto(`/stories/${story.slug}/discussion?perspective=newest`);
  await pc.getByRole("article", { name: "Comment by Dana Author" }).getByRole("button", { name: "Report" }).first().click();
  await pc.getByRole("dialog").getByLabel("Spam or advertising").check();
  await pc.getByRole("button", { name: "Submit report" }).click();
  await expect(pc.getByText(/we'll take a look/i)).toBeVisible();

  // Ordinary users can't reach the moderation queue.
  expect((await c.request.get("/api/admin/reports")).status()).toBe(403);

  // The admin (moderator role) resolves it in the Newsroom.
  const m = await browser.newContext({ baseURL, storageState: await admin.storageState() });
  const pm = await m.newPage();
  await pm.goto("/admin/reports");
  await expect(pm.getByText("Phones pull attention away from lessons").first()).toBeVisible();
  await pm.getByLabel("Reason (recorded and shown to the user on enforcement)").first().fill("Not spam — a substantive argument");
  await pm.getByRole("button", { name: "Record decision" }).first().click();
  await expect(pm.getByText("Recorded.").first()).toBeVisible();
  const open = await (await m.request.get("/api/admin/reports?status=open")).json();
  expect(open.reports.filter((r: { targetType: string }) => r.targetType === "comment")).toHaveLength(0);
  const dismissed = await (await m.request.get("/api/admin/reports?status=dismissed")).json();
  expect(dismissed.reports).toHaveLength(1);

  // The comment stays up (disagreement is not abuse).
  await pa.reload();
  await expect(pa.getByText("Phones pull attention away from lessons")).toBeVisible();
  await Promise.all([a.close(), b.close(), c.close(), m.close()]);
});
