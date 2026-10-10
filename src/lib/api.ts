import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "./errors";
import { reportError } from "@/server/services/errors";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: same-origin check on writes (CSRF), JSON errors,
 * and error reporting for anything unexpected.
 */
export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const out = await fn(req, (await ctx?.params) ?? ({} as P));
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input", code: "invalid" }, { status: 400 });
      await reportError(e, { path: new URL(req.url).pathname });
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  // Browsers send Origin on cross-site POSTs; absence means a same-origin or non-browser client.
  if (!origin) {
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site request refused", "csrf");
    return;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request refused", "csrf");
  }
  const allowed = [host, ...(process.env.APP_URL ? [new URL(process.env.APP_URL).host] : [])].filter(Boolean);
  if (!allowed.includes(originHost)) throw new HttpError(403, "Cross-site request refused", "csrf");
}

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body", "invalid");
  }
  return schema.parse(raw);
}

export const clientKey = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
