import { expect, test } from "@playwright/test";
import { adminContext, apiSignup, publishStory, uniqueEmail } from "./helpers";

test("E: one user's rating is not accessible to another; aggregates expose no individuals", async ({ browser, baseURL }) => {
  const admin = await adminContext(baseURL!);
  const story = await publishStory(admin, { headline: "Privacy check: school phone storage" });

  const a = await browser.newContext({ baseURL });
  const b = await browser.newContext({ baseURL });
  await apiSignup(a.request, uniqueEmail("ea"), "Privacy A");
  await apiSignup(b.request, uniqueEmail("eb"), "Privacy B");

  const r = await a.request.post(`/api/questions/${story.questionId}/ratings`, { data: { questionVersion: 1, response: { type: "scale", value: 7 } } });
  expect(r.ok()).toBeTruthy();

  // B cannot see A's rating anywhere.
  const bMine = await (await b.request.get("/api/me/ratings")).json();
  expect(bMine.ratings).toHaveLength(0);
  expect((await b.request.get(`/api/stories/${story.id}/results`)).status()).toBe(403);
  const bPage = await b.newPage();
  await bPage.goto(`/stories/${story.slug}/results`);
  await expect(bPage).toHaveURL(new RegExp(`/stories/${story.slug}$`));
  await expect(bPage.getByText(/you answered/i)).toHaveCount(0);

  // After B answers, the aggregate is visible but contains no user identifiers.
  await b.request.post(`/api/questions/${story.questionId}/ratings`, { data: { questionVersion: 1, response: { type: "uncertain" } } });
  const res = await (await b.request.get(`/api/stories/${story.id}/results`)).json();
  expect(res.results[0].distribution.validCount).toBe(1);
  expect(res.results[0].distribution.uncertainCount).toBe(1);
  expect(res.myRatings).toHaveLength(1);
  expect(res.myRatings[0].type).toBe("uncertain");
  const text = JSON.stringify(res);
  const meA = await (await a.request.get("/api/me/export")).json();
  expect(text).not.toContain(meA.account.id);
  expect(text).not.toContain(meA.account.email);

  // Guests can't read ratings either.
  const guest = await browser.newContext({ baseURL });
  expect((await guest.request.get("/api/me/ratings")).status()).toBe(401);
  await Promise.all([a.close(), b.close(), guest.close()]);
});
