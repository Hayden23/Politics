import { expect, test } from "@playwright/test";
import { adminContext, apiSignup, BRIEFING, uniqueEmail } from "./helpers";

test("F: left/right perspectives and coverage balance appear only after rating; notifications reach followers", async ({ page, baseURL }) => {
  const admin = await adminContext(baseURL!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ok = async (r: Awaited<ReturnType<typeof admin.post>>): Promise<any> => {
    expect(r.ok(), `${r.url()} ${r.status()} ${await r.text()}`).toBeTruthy();
    return r.json();
  };
  await ok(await admin.post("/api/admin/publishers", { data: { name: "Lefty Times", domain: "leftytimes.example", lean: "lean_left", leanBasis: "Test fixture rating" } }));
  await ok(await admin.post("/api/admin/publishers", { data: { name: "Right Ledger", domain: "rightledger.example", lean: "lean_right", leanBasis: "Test fixture rating" } }));
  const { topics } = await (await admin.get("/api/topics")).json();
  const topicId = topics.find((t: { slug: string }) => t.slug === "climate-energy").id;

  // A reader follows the topic before the story is published.
  await apiSignup(page.request, uniqueEmail("f"), "Reader F");
  await ok(await page.request.patch("/api/me/settings", { data: { topics: ["climate-energy"] } }));

  const { id, slug } = await ok(await admin.post("/api/admin/stories", { data: { headline: "State weighs a ban on new gas hookups", briefing: BRIEFING, topicId } }));
  const left = await ok(await admin.post(`/api/admin/stories/${id}/sources`, { data: { publisherName: "Lefty Times", sourceUrl: "https://leftytimes.example/gas", sourceType: "news_article", relationshipType: "factual_reporting" } }));
  const right = await ok(await admin.post(`/api/admin/stories/${id}/sources`, { data: { publisherName: "Right Ledger", sourceUrl: "https://rightledger.example/gas", sourceType: "news_article", relationshipType: "analysis" } }));
  // One-sided perspectives are refused at review.
  await ok(await admin.patch(`/api/admin/stories/${id}`, { data: { perspectives: [{ side: "left", summary: "Supporters frame it as a climate step.", arguments: [{ text: "Buildings are a large source of emissions.", sourceIds: [left.id] }] }] } }));
  await ok(await admin.post(`/api/admin/stories/${id}/question`, { data: { questionText: "Do you support banning gas hookups in new buildings?" } }));
  expect((await admin.post(`/api/admin/stories/${id}/submit-review`)).status()).toBe(400);
  await ok(await admin.patch(`/api/admin/stories/${id}`, {
    data: {
      perspectives: [
        { side: "left", summary: "Supporters frame it as a climate step.", arguments: [{ text: "Buildings are a large source of emissions.", sourceIds: [left.id] }], framing: "Clean energy transition", values: ["sustainability"] },
        { side: "right", summary: "Opponents frame it as a mandate that raises costs.", arguments: [{ text: "Electric retrofits can be expensive for builders.", sourceIds: [right.id] }], framing: "Gas ban", values: ["choice", "affordability"] },
      ],
    },
  }));
  const check = await ok(await admin.post(`/api/admin/stories/${id}/balance-check`, { data: { ai: false } }));
  expect(Array.isArray(check.check.issues)).toBe(true);
  await ok(await admin.post(`/api/admin/stories/${id}/submit-review`));
  await ok(await admin.post(`/api/admin/stories/${id}/approve`));
  await ok(await admin.post(`/api/admin/stories/${id}/publish`));

  // The follower is notified.
  const notes = await (await page.request.get("/api/me/notifications")).json();
  expect(notes.notifications[0]).toMatchObject({ kind: "new_story", link: `/stories/${slug}` });

  // Before rating: no perspectives, no outlet names.
  expect((await page.request.get(`/api/stories/${id}/perspectives`)).status()).toBe(403);
  await page.goto(`/stories/${slug}/perspectives`);
  await expect(page).toHaveURL(new RegExp(`/stories/${slug}$`));
  await expect(page.getByText("Lefty Times")).toHaveCount(0);
  await expect(page.getByText("Opponents frame it")).toHaveCount(0);

  await page.getByLabel("Somewhat support", { exact: true }).check();
  await page.getByRole("button", { name: "Submit my view" }).click();
  await page.waitForURL(/\/results$/);
  await page.getByRole("link", { name: /how the left and right see it/i }).click();
  await expect(page.getByRole("heading", { name: "How each side sees it" })).toBeVisible();
  await expect(page.getByText("From the left")).toBeVisible();
  await expect(page.getByText("From the right")).toBeVisible();
  await expect(page.getByText("Opponents frame it as a mandate that raises costs.")).toBeVisible();
  await expect(page.getByText("Right Ledger").first()).toBeVisible();

  // Breakdowns page renders and hides small groups.
  await page.goto(`/stories/${slug}/breakdowns`);
  await expect(page.getByText(/not enough responses yet/i).first()).toBeVisible();
});
