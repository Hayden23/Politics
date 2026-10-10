import { route } from "@/lib/api";
import { destroySession } from "@/server/auth/session";

export const POST = route(async () => {
  await destroySession();
  return { ok: true };
});
