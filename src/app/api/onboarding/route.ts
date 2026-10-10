import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { completeOnboarding, onboardingSchema } from "@/server/services/identity";
import { track } from "@/server/services/analytics";

export const POST = route(async (req) => {
  const actor = await requireApiActor();
  const input = await body(req, onboardingSchema);
  await completeOnboarding(actor.id, input);
  await track("onboarding_completed", { subjectId: actor.id });
  return { ok: true };
});
