import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { publishStory } from "@/server/services/editorial";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const actor = await requireApiEditor();
  const s = await publishStory(actor, z.string().uuid().parse(id));
  return { id: s.id, status: s.status, version: s.currentVersion };
});
