import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { toggleReaction } from "@/server/services/community";
import { rateLimit } from "@/server/services/rateLimit";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const actor = await requireApiActor();
  await rateLimit("reaction", actor.id);
  return toggleReaction(actor, z.string().uuid().parse(id), "insightful");
});
