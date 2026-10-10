import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { myRatings } from "@/server/services/ratings";

/** Only ever returns the caller's own ratings; there is no way to name another user. */
export const GET = route(async (req) => {
  const topic = new URL(req.url).searchParams.get("topic") ?? undefined;
  return { ratings: await myRatings(await requireApiActor(), { topic }) };
});
