import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { commentBodySchema, deleteComment, editComment } from "@/server/services/community";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  const input = await body(req, commentBodySchema);
  await editComment(actor, z.string().uuid().parse(id), input.body);
  return { ok: true };
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const actor = await requireApiActor();
  await deleteComment(actor, z.string().uuid().parse(id));
  return { ok: true };
});
