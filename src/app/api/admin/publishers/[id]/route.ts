import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiEditor } from "@/server/auth/session";
import { publisherSchema, upsertPublisher } from "@/server/services/publishers";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const p = await upsertPublisher(await requireApiEditor(), await body(req, publisherSchema), z.string().uuid().parse(id));
  return { id: p.id };
});
