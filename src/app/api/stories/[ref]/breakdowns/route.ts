import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { storyBreakdowns } from "@/server/services/breakdowns";

/** Opt-in, threshold-protected breakdowns — 403 until the caller has rated the story. */
export const GET = route<{ ref: string }>(async (_req, { ref }) => storyBreakdowns(ref, await getActor()));
