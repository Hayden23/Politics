import { z } from "zod";
import { cookies } from "next/headers";
import { route, body } from "@/lib/api";
import { requireApiActor, SESSION_COOKIE } from "@/server/auth/session";
import { deleteAccount } from "@/server/services/identity";
import { badRequest } from "@/lib/errors";

export const DELETE = route(async (req) => {
  const actor = await requireApiActor();
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  if (confirm !== "DELETE") throw badRequest("Type DELETE to confirm");
  await deleteAccount(actor.id);
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
});
