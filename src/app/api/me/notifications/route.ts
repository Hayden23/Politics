import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { listNotifications, markRead, unreadCount } from "@/server/services/notifications";

export const GET = route(async () => {
  const actor = await requireApiActor();
  return { notifications: await listNotifications(actor), unread: await unreadCount(actor.id) };
});

/** Mark some (ids) or all notifications read. */
export const POST = route(async (req) => {
  const actor = await requireApiActor();
  const { ids } = await body(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  await markRead(actor, ids);
  return { ok: true };
});
