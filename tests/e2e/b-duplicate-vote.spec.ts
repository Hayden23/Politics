import { expect, test } from "@playwright/test";
import { adminContext, apiSignup, publishStory, uniqueEmail } from "./helpers";

test("B: repeated submissions create one rating and count once", async ({ page, baseURL }) => {
  const admin = await adminContext(baseURL!);
  const story = await publishStory(admin, { headline: "Duplicate vote check: phone storage rule" });
  await apiSignup(page.request, uniqueEmail("b"), "Reader B");

  const submit = () => page.request.post(`/api/questions/${story.questionId}/ratings`, { data: { questionVersion: 1, response: { type: "scale", value: 3 } } });
  const responses = await Promise.all(Array.from({ length: 8 }, submit));
  expect(responses.every((r) => r.ok())).toBe(true);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(bodies.filter((b) => b.created)).toHaveLength(1);

  // Also through the UI: double-clicking submit on a second account.
  const other = await page.context().browser()!.newContext();
  const p2 = await other.newPage();
  await apiSignup(p2.request, uniqueEmail("b2"), "Reader B2");
  await p2.goto(`/stories/${story.slug}`);
  await p2.getByLabel("Oppose", { exact: true }).check();
  await p2.getByRole("button", { name: "Submit my view" }).dblclick();
  await p2.waitForURL(/\/results$/);

  const results = await (await page.request.get(`/api/stories/${story.id}/results`)).json();
  expect(results.results[0].distribution.validCount).toBe(2);
  expect(results.results[0].distribution.totalCount).toBe(2);
  // A different second answer is refused (must use update).
  const changed = await page.request.post(`/api/questions/${story.questionId}/ratings`, { data: { questionVersion: 1, response: { type: "scale", value: 7 } } });
  expect(changed.status()).toBe(409);
  await other.close();
});
