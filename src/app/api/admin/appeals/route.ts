import { route } from "@/lib/api";
import { requireApiModerator } from "@/server/auth/session";
import { listAppeals } from "@/server/services/moderation";

export const GET = route(async () => ({ appeals: await listAppeals(await requireApiModerator()) }));
