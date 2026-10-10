import { expect, test } from "@playwright/test";
import { adminContext, BRIEFING } from "./helpers";

test("C: AI-assisted drafts cannot be published until a human editor approves", async ({ page, baseURL }) => {
  const admin = await adminContext(baseURL!);
  const { topics } = await (await admin.get("/api/topics")).json();
  const topicId = topics.find((t: { slug: string }) => t.slug === "housing-cost-of-living").id;

  const created = await admin.post("/api/admin/stories", { data: { headline: "City weighs limits on short-term rentals", briefing: "", topicId } });
  expect(created.ok()).toBeTruthy();
  const { id, slug } = await created.json();

  const draft = await admin.post(`/api/admin/stories/${id}/generate-draft`, { data: { editorNotes: "Focus on the vote", material: [{ publisher: "Metro Desk", url: "https://example.org/rentals", text: "The council will vote next week on capping short-term rental permits at 2,000 citywide. Hotel groups support the cap; some homeowners oppose it." }] } });
  expect(draft.ok(), await draft.text()).toBeTruthy();
  expect((await draft.json()).draft.headline).toContain("MOCK");

  // Human writes the briefing (AI output isn't applied automatically), adds a source and question.
  expect((await admin.patch(`/api/admin/stories/${id}`, { data: { briefing: BRIEFING } })).ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/stories/${id}/sources`, { data: { publisherName: "Metro Desk", sourceUrl: "https://example.org/rentals", sourceType: "news_article", relationshipType: "factual_reporting" } })).ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/stories/${id}/question`, { data: { questionText: "Do you support capping short-term rental permits?" } })).ok()).toBeTruthy();

  // Publishing without approval is rejected at every stage before approval.
  expect((await admin.post(`/api/admin/stories/${id}/publish`)).status()).toBe(409);
  expect((await admin.post(`/api/admin/stories/${id}/submit-review`)).ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/stories/${id}/publish`)).status()).toBe(409);
  // Not visible to readers yet.
  expect((await page.request.get(`/api/stories/${slug}`)).status()).toBe(404);

  // Ordinary users can't approve.
  const userCtx = page.request;
  await userCtx.post("/api/auth/signup", { data: { email: `c-${Date.now()}@e2e.test`, password: "correct horse battery", displayName: "Not An Editor", acceptTerms: true } });
  expect((await userCtx.post(`/api/admin/stories/${id}/approve`)).status()).toBe(403);

  expect((await admin.post(`/api/admin/stories/${id}/approve`)).ok()).toBeTruthy();
  expect((await admin.post(`/api/admin/stories/${id}/publish`)).ok()).toBeTruthy();

  await page.context().addCookies([{ name: "cl_welcomed", value: "1", url: baseURL! }]);
  await page.goto("/?topic=housing-cost-of-living");
  await expect(page.getByRole("link", { name: "City weighs limits on short-term rentals" })).toBeVisible();
});
