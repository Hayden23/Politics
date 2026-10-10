import { z } from "zod";
import { route, body } from "@/lib/api";
import { getActor, visitorId } from "@/server/auth/session";
import { track } from "@/server/services/analytics";

/** Client-originated events. Only a small allowlist; never opinion values. */
const schema = z.object({
  name: z.enum(["story_shared", "perspective_explored"]),
  storyId: z.string().uuid().optional(),
  props: z.record(z.string(), z.union([z.string().max(40), z.number(), z.boolean()])).optional(),
});

export const POST = route(async (req) => {
  const e = await body(req, schema);
  const actor = await getActor();
  await track(e.name, { subjectId: actor?.id ?? (await visitorId()), storyId: e.storyId, props: e.props });
  return { ok: true };
});
