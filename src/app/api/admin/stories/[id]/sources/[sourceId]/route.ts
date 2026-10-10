import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { detachSource } from "@/server/services/editorial";

export const DELETE = route<{ id: string; sourceId: string }>(async (_req, { id, sourceId }) => {
  const actor = await requireApiEditor();
  await detachSource(actor, z.string().uuid().parse(id), z.string().uuid().parse(sourceId));
  return { ok: true };
});
