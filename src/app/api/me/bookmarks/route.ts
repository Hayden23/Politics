import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { addBookmark, listBookmarks } from "@/server/services/bookmarks";
import { track } from "@/server/services/analytics";

export const GET = route(async () => ({ bookmarks: await listBookmarks(await requireApiActor()) }));

export const POST = route(async (req) => {
  const actor = await requireApiActor();
  const { storyId } = await body(req, z.object({ storyId: z.string().uuid() }));
  const r = await addBookmark(actor, storyId);
  if (r.created) await track("bookmark_created", { subjectId: actor.id, storyId });
  return r;
});
