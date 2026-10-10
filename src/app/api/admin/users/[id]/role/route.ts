import { z } from "zod";
import { route, body } from "@/lib/api";
import { requireApiActor } from "@/server/auth/session";
import { setRole } from "@/server/services/admin";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { role } = await body(req, z.object({ role: z.enum(["user", "moderator", "editor", "admin"]) }));
  await setRole(await requireApiActor(), z.string().uuid().parse(id), role);
  return { ok: true };
});
