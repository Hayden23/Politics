import { expect, test } from "@playwright/test";
import { adminContext, apiSignup, publishStory, uniqueEmail } from "./helpers";

test("A: a new user reads source-blind, rates, sees results, sources, perspectives and My Views", async ({ page, baseURL }) => {
  const admin = await adminContext(baseURL!);
  const story = await publishStory(admin, { headline: "Lawmakers advance a plan to lock away student phones", publisher: "Capitol Ledger", originalHeadline: "Phone ban clears first hurdle" });

  // Guests land on the welcome screen first and can browse as a guest.
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();

  await apiSignup(page.request, uniqueEmail("a"), "Reader A");
  await page.goto("/");
  await page.getByRole("link", { name: "Lawmakers advance a plan to lock away student phones" }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${story.slug}$`));

  // Source identity and results are hidden before rating — in the page and in the API.
  await expect(page.getByText("Capitol Ledger")).toHaveCount(0);
  await expect(page.getByText("Phone ban clears first hurdle")).toHaveCount(0);
  await expect(page.getByText(/participating users/i)).toHaveCount(0);
  const raw = await (await page.request.get(`/api/stories/${story.slug}`)).text();
  expect(raw).not.toContain("Capitol Ledger");
  expect((await page.request.get(`/api/stories/${story.id}/results`)).status()).toBe(403);
  expect((await page.request.get(`/api/stories/${story.id}/sources`)).status()).toBe(403);
  await page.goto(`/stories/${story.slug}/sources`);
  await expect(page).toHaveURL(new RegExp(`/stories/${story.slug}$`));

  // Read and rate. Selecting alone doesn't submit.
  await expect(page.getByText(/phones in lockers/)).toBeVisible();
  await page.getByLabel("Support", { exact: true }).check();
  await expect(page).toHaveURL(new RegExp(`/stories/${story.slug}$`));
  await page.getByRole("button", { name: "Submit my view" }).click();

  // Results reveal.
  await page.waitForURL(new RegExp(`/stories/${story.slug}/results$`));
  await expect(page.getByRole("heading", { name: "Participating users' responses" })).toBeVisible();
  await expect(page.getByText("(you)")).toBeVisible();
  await expect(page.getByText(/1 response/)).toBeVisible();
  await expect(page.getByText(/Small sample/)).toBeVisible();

  // Source reveal.
  await page.getByRole("link", { name: /see the original coverage/i }).click();
  await expect(page.getByText("Capitol Ledger")).toBeVisible();
  await expect(page.getByText("Phone ban clears first hurdle")).toBeVisible();

  // A different perspective.
  await page.getByRole("link", { name: "Perspectives" }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${story.slug}/discussion`));
  await expect(page.getByText(/main reason behind your position/i).first()).toBeVisible();

  // My Views.
  await page.goto("/me");
  await expect(page.getByText("Lawmakers advance a plan to lock away student phones").first()).toBeVisible();
  await expect(page.getByText("Support", { exact: true }).first()).toBeVisible();
});
