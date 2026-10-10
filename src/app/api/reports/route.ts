import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { createReport, reportSchema } from "@/server/services/moderation";
import { rateLimit } from "@/server/services/rateLimit";
import { track } from "@/server/services/analytics";

export const POST = route(async (req) => {
  const actor = await requireApiActor();
  await rateLimit("report", actor.id);
  const r = await createReport(actor, await body(req, reportSchema));
  await track("report_submitted", { subjectId: actor.id, props: { surface: r.targetType } });
  return { id: r.id, status: r.status };
});
