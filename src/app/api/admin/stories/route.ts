import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { createStory, listForEditors, storyContentSchema } from "@/server/services/editorial";
import type { StoryStatus } from "@/domain/storyWorkflow";

export const GET = route(async (req) => {
  await requireApiEditor();
  const status = new URL(req.url).searchParams.get("status") as StoryStatus | null;
  return { stories: await listForEditors(status ?? undefined) };
});

export const POST = route(async (req) => {
  const actor = await requireApiEditor();
  const s = await createStory(actor, await body(req, storyContentSchema));
  return { id: s.id, slug: s.slug };
});
