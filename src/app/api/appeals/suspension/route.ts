import { z } from "zod";
import { eq } from "drizzle-orm";
import { route, body, clientKey } from "@/lib/api";
import { db } from "@/server/db";
import { userCredentials, users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { fileAppeal, latestSuspension } from "@/server/services/moderation";
import { rateLimit } from "@/server/services/rateLimit";
import { notFound, unauthorized } from "@/lib/errors";
import { sql } from "drizzle-orm";

/** Suspended accounts can't sign in, so they prove ownership with their password here. */
export const POST = route(async (req) => {
  const input = await body(req, z.object({ email: z.string().max(254), password: z.string().max(200), body: z.string().trim().min(10).max(2000) }));
  await rateLimit("login", `${clientKey(req)}:${input.email.toLowerCase()}`);
  const [row] = await db
    .select({ id: users.id, status: users.accountStatus, hash: userCredentials.passwordHash })
    .from(users)
    .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(sql`lower(${users.email}) = ${input.email.trim().toLowerCase()}`);
  if (!row || !(await verifyPassword(input.password, row.hash))) throw unauthorized("Email or password is incorrect");
  const s = row.status === "suspended" ? await latestSuspension(row.id) : null;
  if (!s) throw notFound("This account has no suspension to appeal");
  await fileAppeal(row.id, s.id, input.body);
  return { ok: true };
});
