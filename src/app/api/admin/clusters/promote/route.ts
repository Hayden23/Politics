import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { promoteCluster } from "@/server/services/ingestion";

export const POST = route(async (req) => {
  const { candidateIds } = await body(req, z.object({ candidateIds: z.array(z.string().uuid()).min(1).max(50) }));
  const s = await promoteCluster(await requireApiEditor(), candidateIds);
  return { storyId: s.id };
});
