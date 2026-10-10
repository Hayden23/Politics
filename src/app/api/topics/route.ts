import { route } from "@/lib/api";
import { listTopics } from "@/server/services/reader";

export const GET = route(async () => ({ topics: await listTopics() }));
