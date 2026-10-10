import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { getForEditor, saveAiDraft } from "@/server/services/editorial";
import { generateDraft } from "@/server/ai";
import { rateLimit } from "@/server/services/rateLimit";

const schema = z.object({
  editorNotes: z.string().max(4000).default(""),
  material: z
    .array(z.object({ publisher: z.string().max(200), url: z.string().max(2000).nullable().optional(), text: z.string().trim().min(20, "Paste at least a paragraph of source material").max(20000) }))
    .min(1, "Provide source material to draft from")
    .max(8),
});

/** Produces an unapproved AI draft stored alongside the story version. It never changes published content. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  await rateLimit("ai", actor.id);
  const storyId = z.string().uuid().parse(id);
  const input = await body(req, schema);
  const story = await getForEditor(storyId);
  const result = await generateDraft({
    topic: story.topic?.name ?? null,
    editorNotes: input.editorNotes,
    material: input.material.map((m, i) => ({ ref: i + 1, publisher: m.publisher, url: m.url ?? null, text: m.text })),
  });
  const draft = { ...result.draft, model: result.model, provider: result.provider, material: input.material.map((m, i) => ({ ref: i + 1, publisher: m.publisher, url: m.url ?? null })) };
  await saveAiDraft(actor, storyId, draft);
  return { draft };
});
