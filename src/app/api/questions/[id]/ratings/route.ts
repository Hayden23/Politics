import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { submitRating, updateRating } from "@/server/services/ratings";
import { rateLimit } from "@/server/services/rateLimit";
import { track } from "@/server/services/analytics";

const response = z.union([
  z.object({ type: z.literal("scale"), value: z.number().int() }),
  z.object({ type: z.literal("uncertain") }),
]);

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  await rateLimit("rating", actor.id);
  const input = await body(req, z.object({ questionVersion: z.number().int().positive(), response }));
  const r = await submitRating(actor, z.string().uuid().parse(id), input);
  if (r.created) await track("rating_submitted", { subjectId: actor.id });
  return { created: r.created, rating: { questionId: r.rating.questionId, questionVersion: r.rating.questionVersion, type: r.rating.responseType, value: r.rating.responseValue } };
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  await rateLimit("rating", actor.id);
  const input = await body(req, z.object({ response }));
  const r = await updateRating(actor, z.string().uuid().parse(id), input);
  if (r.changed) await track("rating_updated", { subjectId: actor.id });
  return { changed: r.changed, rating: { questionId: r.rating.questionId, type: r.rating.responseType, value: r.rating.responseValue } };
});
