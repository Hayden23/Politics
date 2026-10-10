import { route, body, clientKey } from "@/lib/api";
import { signup, signupSchema } from "@/server/services/identity";
import { createSession } from "@/server/auth/session";
import { rateLimit } from "@/server/services/rateLimit";
import { track } from "@/server/services/analytics";

export const POST = route(async (req) => {
  await rateLimit("signup", clientKey(req));
  const input = await body(req, signupSchema);
  const user = await signup(input);
  await createSession(user.id);
  await track("account_created", { subjectId: user.id, props: { via: "password" } });
  return { ok: true, next: "/onboarding" };
});
