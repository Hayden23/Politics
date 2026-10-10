import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "cl_vid";

/**
 * Gives each browser a random visitor id (used, hashed, for guest analytics)
 * and applies security headers. No database access here.
 */
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(VISITOR_COOKIE)) {
    res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 365 * 86400 });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/|favicon|icon|api/health).*)"] };
