import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { addCandidate, candidateSchema, listCandidates } from "@/server/services/ingestion";
import { badRequest } from "@/lib/errors";

export const GET = route(async () => ({ candidates: await listCandidates(await requireApiEditor()) }));
export const POST = route(async (req) => {
  await requireApiEditor();
  const c = await addCandidate(await body(req, candidateSchema));
  if (!c) throw badRequest("That link is already a candidate or isn't a valid URL", "duplicate");
  return { id: c.id, duplicateOf: c.duplicateOf };
});
