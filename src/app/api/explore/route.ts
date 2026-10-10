import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { exploreQuestions } from "@/server/services/explore";

export const GET = route(async (req) => {
  const u = new URL(req.url).searchParams;
  return { questions: await exploreQuestions(await getActor(), { topic: u.get("topic") ?? undefined, sort: u.get("sort") === "recent" ? "recent" : "popular" }) };
});
