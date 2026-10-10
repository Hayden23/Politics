import { z } from "zod";
import { route } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { dismissCandidate } from "@/server/services/ingestion";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  await dismissCandidate(await requireApiEditor(), z.string().uuid().parse(id));
  return { ok: true };
});
