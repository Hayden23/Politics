import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { comments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { commentBodySchema, createComment } from "@/server/services/community";
import { rateLimit } from "@/server/services/rateLimit";
import { track } from "@/server/services/analytics";
import { notFound } from "@/lib/errors";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  await rateLimit("comment", actor.id);
  const input = await body(req, commentBodySchema);
  const [parent] = await db.select({ questionId: comments.questionId }).from(comments).where(eq(comments.id, z.string().uuid().parse(id)));
  if (!parent) throw notFound("Comment not found");
  const c = await createComment(actor, parent.questionId, { body: input.body, parentId: id });
  await track("reply_submitted", { subjectId: actor.id, storyId: c.storyId, props: { isReply: true } });
  return { id: c.id };
});
