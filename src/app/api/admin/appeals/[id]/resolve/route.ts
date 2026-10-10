import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiModerator } from "@/server/auth/session";
import { resolveAppeal } from "@/server/services/moderation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiModerator();
  const input = await body(req, z.object({ decision: z.enum(["upheld", "overturned"]), resolution: z.string().trim().min(5).max(1000) }));
  await resolveAppeal(actor, z.string().uuid().parse(id), input.decision, input.resolution);
  return { ok: true };
});
