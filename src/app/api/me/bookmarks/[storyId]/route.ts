import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { removeBookmark } from "@/server/services/bookmarks";

export const DELETE = route<{ storyId: string }>(async (_req, { storyId }) => {
  await removeBookmark(await requireApiActor(), z.string().uuid().parse(storyId));
  return { ok: true };
});
