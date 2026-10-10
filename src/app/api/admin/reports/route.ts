import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { listReports } from "@/server/services/moderation";

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams.get("status");
  const status = s === "escalated" || s === "resolved" || s === "dismissed" ? s : "open";
  return { reports: await listReports(await requireApiActor(), status) };
});
