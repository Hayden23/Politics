import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { listFeed } from "@/server/services/reader";

export const GET = route(async (req) => {
  const u = new URL(req.url).searchParams;
  const answered = u.get("answered");
  return listFeed(await getActor(), {
    topic: u.get("topic") ?? undefined,
    offset: Number(u.get("offset") ?? 0) || 0,
    limit: Number(u.get("limit") ?? 12) || 12,
    answered: answered === null ? undefined : answered === "true",
  });
});
