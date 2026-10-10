import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { requestChanges } from "@/server/services/editorial";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const { note } = await body(req, z.object({ note: z.string().trim().min(3).max(1000) }));
  const s = await requestChanges(actor, z.string().uuid().parse(id), note);
  return { id: s.id, status: s.status };
});
