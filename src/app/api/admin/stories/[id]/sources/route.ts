import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { attachSource, sourceSchema } from "@/server/services/editorial";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const s = await attachSource(actor, z.string().uuid().parse(id), await body(req, sourceSchema));
  return { id: s.id };
});
