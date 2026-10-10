import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { hideComment } from "@/server/services/community";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  await hideComment(await requireApiActor(), z.string().uuid().parse(id));
  return { ok: true };
});
