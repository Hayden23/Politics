import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, openState, STATE_COOKIE } from "@/server/auth/oauth";
import { upsertOAuthUser } from "@/server/services/identity";
import { createSession } from "@/server/auth/session";
import { track } from "@/server/services/analytics";
import { reportError } from "@/server/services/errors";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const s = openState(jar.get(STATE_COOKIE)?.value);
  jar.delete(STATE_COOKIE);
  const code = url.searchParams.get("code");
  if (!s || !code || url.searchParams.get("state") !== s.state) return NextResponse.redirect(new URL("/login?error=oauth_state", req.url));
  try {
    const profile = await exchangeCode(req, s, code);
    const user = await upsertOAuthUser("google", profile.subject, profile);
    if (user.accountStatus === "suspended" || user.accountStatus === "deleted") return NextResponse.redirect(new URL("/login?error=suspended", req.url));
    await createSession(user.id);
    if (Date.now() - user.createdAt.getTime() < 60_000) await track("account_created", { subjectId: user.id, props: { via: "google" } });
    return NextResponse.redirect(new URL(user.onboardedAt ? s.next : "/onboarding", req.url));
  } catch (e) {
    await reportError(e, { path: "/api/auth/oauth/google/callback" });
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
}
