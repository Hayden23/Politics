import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { blockUser, unblockUser } from "@/server/services/community";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  await blockUser(await requireApiActor(), z.string().uuid().parse(id));
  return { ok: true };
});
export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  await unblockUser(await requireApiActor(), z.string().uuid().parse(id));
  return { ok: true };
});
