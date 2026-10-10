import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { getResults } from "@/server/services/reader";
import { track } from "@/server/services/analytics";

export const GET = route<{ ref: string }>(async (_req, { ref }) => {
  const actor = await getActor();
  const r = await getResults(ref, actor);
  await track("results_viewed", { subjectId: actor?.id, storyId: r.storyId, props: { surface: "api" } });
  return r;
});
