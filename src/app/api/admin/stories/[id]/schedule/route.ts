import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { schedulePublish } from "@/server/services/editorial";

/** `{ at: ISO string }` schedules an approved story; `{ at: null }` cancels. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiEditor();
  const { at } = await body(req, z.object({ at: z.coerce.date().nullable() }));
  const s = await schedulePublish(actor, z.string().uuid().parse(id), at);
  return { id: s.id, scheduledPublishAt: s.scheduledPublishAt };
});
