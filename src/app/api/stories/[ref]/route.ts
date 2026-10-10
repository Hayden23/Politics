import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { getBriefing } from "@/server/services/reader";

/** Source-blind briefing: no publisher, no results, no comments. */
export const GET = route<{ ref: string }>(async (_req, { ref }) => getBriefing(ref, await getActor()));
