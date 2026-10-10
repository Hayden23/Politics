import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { forbidden, unauthorized } from "@/lib/errors";
import { type Actor, isEditor, isModerator } from "./roles";

export const SESSION_COOKIE = "cl_session";
export const VISITOR_COOKIE = "cl_vid";
const SESSION_DAYS = 30;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function issueSessionToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function createSession(userId: string) {
  const { token, expiresAt } = await issueSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function actorForToken(token: string | undefined): Promise<Actor | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  const u = row.user;
  if (u.accountStatus === "suspended" || u.accountStatus === "deleted") return null;
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    displayName: u.displayName,
    accountStatus: u.accountStatus,
    restrictedUntil: u.restrictedUntil,
    onboarded: !!u.onboardedAt,
  };
}

export async function getActor(): Promise<Actor | null> {
  return actorForToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function visitorId(): Promise<string | null> {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}

// ── Route handlers ──
export async function requireApiActor(): Promise<Actor> {
  const a = await getActor();
  if (!a) throw unauthorized();
  return a;
}
export async function requireApiEditor(): Promise<Actor> {
  const a = await requireApiActor();
  if (!isEditor(a)) throw forbidden("Editor access required");
  return a;
}
export async function requireApiModerator(): Promise<Actor> {
  const a = await requireApiActor();
  if (!isModerator(a)) throw forbidden("Moderator access required");
  return a;
}

// ── Pages ──
export async function requirePageActor(next?: string): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return a;
}
