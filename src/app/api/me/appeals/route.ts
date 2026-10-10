import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { fileAppeal } from "@/server/services/moderation";

export const POST = route(async (req) => {
  const actor = await requireApiActor();
  const input = await body(req, z.object({ moderationActionId: z.string().uuid(), body: z.string().trim().min(10).max(2000) }));
  const a = await fileAppeal(actor.id, input.moderationActionId, input.body);
  return { id: a.id };
});
