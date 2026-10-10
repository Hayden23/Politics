import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { promoteCandidate } from "@/server/services/ingestion";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const s = await promoteCandidate(await requireApiEditor(), z.string().uuid().parse(id));
  return { storyId: s.id };
});
