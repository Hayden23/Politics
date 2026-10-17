import { route } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { candidateClusters } from "@/server/services/ingestion";

export const GET = route(async () => ({ clusters: await candidateClusters(await requireApiEditor()) }));
