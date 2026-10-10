import "server-only";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { type Actor, isAdmin, isEditor, isModerator, isStaff } from "@/server/auth/roles";

/** Signed-out visitors go to sign-in; signed-in non-staff get a plain 404 so the newsroom isn't advertised. */
async function guard(next: string, allowed: (a: Actor) => boolean): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isStaff(a) || !allowed(a)) notFound();
  return a;
}

export const requireStaff = (next = "/admin") => guard(next, () => true);
export const requireEditor = (next = "/admin") => guard(next, isEditor);
export const requireModerator = (next = "/admin") => guard(next, isModerator);
/** Reports: moderators handle everything; editors see story reports. */
export const requireReportHandler = (next = "/admin") => guard(next, (a) => isModerator(a) || isEditor(a));
export const requireAdmin = (next = "/admin") => guard(next, isAdmin);
