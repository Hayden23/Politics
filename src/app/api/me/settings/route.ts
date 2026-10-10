import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { getSettings, preferencesSchema, updatePreferences } from "@/server/services/identity";

export const GET = route(async () => getSettings((await requireApiActor()).id));
export const PATCH = route(async (req) => {
  const actor = await requireApiActor();
  await updatePreferences(actor.id, await body(req, preferencesSchema));
  return { ok: true };
});
