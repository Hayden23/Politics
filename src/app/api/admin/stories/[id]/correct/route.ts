import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { correctStory, correctionSchema } from "@/server/services/editorial";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const s = await correctStory(actor, z.string().uuid().parse(id), await body(req, correctionSchema));
  return { id: s.id, status: s.status, version: s.currentVersion };
});
