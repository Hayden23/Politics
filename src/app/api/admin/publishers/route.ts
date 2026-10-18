import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { listPublishers, publisherSchema, upsertPublisher } from "@/server/services/publishers";

export const GET = route(async () => ({ publishers: await listPublishers(await requireApiEditor()) }));
export const POST = route(async (req) => {
  const p = await upsertPublisher(await requireApiEditor(), await body(req, publisherSchema));
  return { id: p.id };
});
