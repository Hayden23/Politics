export type Role = "user" | "moderator" | "editor" | "admin";

export type Actor = {
  id: string;
  role: Role;
  email: string | null;
  displayName: string | null;
  accountStatus: "active" | "restricted" | "suspended" | "deleted";
  restrictedUntil: Date | null;
  onboarded: boolean;
};

const rank: Record<Role, number> = { user: 0, moderator: 1, editor: 1, admin: 2 };

export const isAdmin = (a: Pick<Actor, "role"> | null | undefined) => a?.role === "admin";
export const isEditor = (a: Pick<Actor, "role"> | null | undefined) => a?.role === "editor" || a?.role === "admin";
export const isModerator = (a: Pick<Actor, "role"> | null | undefined) => a?.role === "moderator" || a?.role === "admin";
export const isStaff = (a: Pick<Actor, "role"> | null | undefined) => !!a && rank[a.role] > 0;

/** Restricted accounts can read and rate but not post until the restriction lapses. */
export function canPost(a: Actor): boolean {
  if (a.accountStatus === "suspended" || a.accountStatus === "deleted") return false;
  if (a.accountStatus === "restricted" && a.restrictedUntil && a.restrictedUntil.getTime() > Date.now()) return false;
  return true;
}
