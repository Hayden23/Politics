import { route } from "@/lib/api";
import { getActor } from "@/server/auth/session";
import { getPerspectives } from "@/server/services/reader";

/** Left/right perspectives — 403 until the caller has rated the story. */
export const GET = route<{ ref: string }>(async (_req, { ref }) => getPerspectives(ref, await getActor()));
