import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { questionSchema, setQuestion } from "@/server/services/editorial";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const q = await setQuestion(actor, z.string().uuid().parse(id), await body(req, questionSchema));
  return { id: q.id, version: q.version, status: q.status };
});
