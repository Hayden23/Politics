import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { getForEditor, storyPatchSchema, updateStory } from "@/server/services/editorial";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  await requireApiEditor();
  return getForEditor(z.string().uuid().parse(id));
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const s = await updateStory(actor, z.string().uuid().parse(id), await body(req, storyPatchSchema));
  return { id: s.id, status: s.status, version: s.currentVersion };
});
