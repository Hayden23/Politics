import { NextResponse } from "next/server";
import { authorizationUrl, googleEnabled, newState, safeNext, sealState, STATE_COOKIE } from "@/server/auth/oauth";

export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login?error=oauth_unavailable", req.url));
  const s = newState(safeNext(new URL(req.url).searchParams.get("next")));
  const res = NextResponse.redirect(authorizationUrl(req, s));
  res.cookies.set(STATE_COOKIE, sealState(s), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
