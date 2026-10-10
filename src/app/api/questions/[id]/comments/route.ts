import { z } from "zod";
import { route, body } from "@/lib/api";
import { getActor, requireApiActor } from "@/server/auth/session";
import { commentBodySchema, createComment, listComments, type Perspective } from "@/server/services/community";
import { rateLimit } from "@/server/services/rateLimit";
import { track } from "@/server/services/analytics";

const perspectives = ["all", "different", "insightful", "newest"] as const;

export const GET = route<{ id: string }>(async (req, { id }) => {
  const p = new URL(req.url).searchParams.get("perspective") ?? "all";
  return listComments(await getActor(), z.string().uuid().parse(id), (perspectives as readonly string[]).includes(p) ? (p as Perspective) : "all");
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  await rateLimit("comment", actor.id);
  const input = await body(req, commentBodySchema);
  const c = await createComment(actor, z.string().uuid().parse(id), { body: input.body });
  await track("comment_submitted", { subjectId: actor.id, storyId: c.storyId });
  return { id: c.id };
});
