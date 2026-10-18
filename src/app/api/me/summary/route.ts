import { route } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { weeklySummary } from "@/server/services/summary";

export const GET = route(async () => weeklySummary((await requireApiActor()).id));
