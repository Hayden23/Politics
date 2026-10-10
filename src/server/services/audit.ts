import type { Executor } from "@/server/db";
import { editorialAuditLog } from "@/server/db/schema";

/** Append-only record of privileged changes. Keep payloads free of personal data. */
export async function audit(
  ex: Executor,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown = null,
  after: unknown = null,
) {
  await ex.insert(editorialAuditLog).values({ actorId, action, entityType, entityId, beforeState: before as never, afterState: after as never });
}
