import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { getSources } from "@/server/services/reader";
import { track } from "@/server/services/analytics";

export const GET = route<{ ref: string }>(async (_req, { ref }) => {
  const actor = await getActor();
  const r = await getSources(ref, actor);
  await track("source_revealed", { subjectId: actor?.id, storyId: r.storyId, props: { surface: "api", sourceCount: r.sources.length } });
  return r;
});
