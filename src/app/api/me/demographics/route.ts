import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { demographicsSchema, setDemographics } from "@/server/services/identity";

export const PUT = route(async (req) => {
  const actor = await requireApiActor();
  const input = await body(req, z.object({ consent: z.boolean(), demographics: demographicsSchema.default({}) }));
  await setDemographics(actor.id, input.consent, input.demographics);
  return { ok: true };
});
