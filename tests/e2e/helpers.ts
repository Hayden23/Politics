import { expect, type APIRequestContext, type Page, request as pwRequest } from "@playwright/test";

let n = 0;
export const uniqueEmail = (p = "user") => `${p}-${Date.now()}-${++n}@e2e.test`;
export const PASSWORD = "correct horse battery";

export async function apiSignup(req: APIRequestContext, email: string, displayName = "Reader " + n) {
  const r = await req.post("/api/auth/signup", { data: { email, password: PASSWORD, displayName, acceptTerms: true } });
  if (r.status() === 409) {
    const l = await req.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(l.ok()).toBeTruthy();
  } else expect(r.ok(), await r.text()).toBeTruthy();
  const o = await req.post("/api/onboarding", { data: { topics: [], demographicsConsent: false } });
  expect(o.ok()).toBeTruthy();
}

export async function adminContext(baseURL: string) {
  const req = await pwRequest.newContext({ baseURL });
  await apiSignup(req, "admin@e2e.test", "Admin Editor");
  return req;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ok(r: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<any> {
  expect(r.ok(), `${r.url()} → ${r.status()} ${await r.text()}`).toBeTruthy();
  return r.json();
}

export const BRIEFING =
  "State lawmakers advanced a bill on Monday that would require public schools to keep students' phones in lockers during the school day. Supporters, including several teachers' groups, said phones distract students and contribute to bullying. Opponents, including some parent organizations, said families need to reach children in emergencies and that districts should decide for themselves.\n\nThe bill passed a committee vote and now goes to the full House. It has not become law. If enacted, it would take effect next school year.";

/** Creates and publishes a story through the editorial API as an admin. */
export async function publishStory(admin: APIRequestContext, opts: { headline: string; publisher?: string; originalHeadline?: string }) {
  const topics = ["education"];
  const { id, slug } = await ok(await admin.post("/api/admin/stories", { data: { headline: opts.headline, briefing: BRIEFING, keyFacts: [{ text: "The bill passed a committee vote." }], disputedClaims: [{ text: "Supporters say phones contribute to bullying." }], uncertainties: [{ text: "How districts would enforce the rule." }] } }));
  await ok(await admin.patch(`/api/admin/stories/${id}`, { data: { topicId: await topicId(admin, topics[0]) } }));
  await ok(await admin.post(`/api/admin/stories/${id}/sources`, { data: { publisherName: opts.publisher ?? "Capitol Ledger", originalHeadline: opts.originalHeadline ?? "Phone ban clears first hurdle", sourceUrl: "https://example.org/phone-ban", sourceType: "news_article", relationshipType: "factual_reporting" } }));
  const q = await ok(await admin.post(`/api/admin/stories/${id}/question`, { data: { questionText: "Do you support requiring schools to lock away student phones during the day?" } }));
  await ok(await admin.post(`/api/admin/stories/${id}/submit-review`));
  await ok(await admin.post(`/api/admin/stories/${id}/approve`));
  await ok(await admin.post(`/api/admin/stories/${id}/publish`));
  return { id: id as string, slug: slug as string, questionId: q.id as string };
}

async function topicId(req: APIRequestContext, slug: string) {
  const { topics } = await ok(await req.get("/api/topics"));
  return topics.find((t: { slug: string }) => t.slug === slug).id as string;
}

export async function signupViaUI(page: Page, email: string, name: string, next = "/") {
  await page.goto(`/signup?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/display name/i).fill(name);
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/onboarding/);
}
