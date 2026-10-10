import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { resolveReport, resolveSchema } from "@/server/services/moderation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const actor = await requireApiActor();
  const r = await resolveReport(actor, z.string().uuid().parse(id), await body(req, resolveSchema));
  return { status: r.report.status, actionId: r.action.id };
});
