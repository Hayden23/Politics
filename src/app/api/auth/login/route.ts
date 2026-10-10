import { z } from "zod";
import { route, body, clientKey } from "@/lib/api";
import { login } from "@/server/services/identity";
import { createSession } from "@/server/auth/session";
import { rateLimit } from "@/server/services/rateLimit";

export const POST = route(async (req) => {
  const input = await body(req, z.object({ email: z.string().max(254), password: z.string().max(200) }));
  await rateLimit("login", `${clientKey(req)}:${input.email.toLowerCase()}`);
  const user = await login(input.email, input.password);
  await createSession(user.id);
  return { ok: true, next: user.onboardedAt ? "/" : "/onboarding" };
});
