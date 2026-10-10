import { db } from "@/server/db";
import { errorEvents } from "@/server/db/schema";

/**
 * Error monitoring: structured log line, a row in error_events for the admin
 * dashboard, and an optional webhook (ERROR_WEBHOOK_URL) for paging.
 */
export async function reportError(e: unknown, ctx: { path?: string; digest?: string } = {}) {
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(JSON.stringify({ level: "error", message: err.message, path: ctx.path, digest: ctx.digest, stack: err.stack?.split("\n").slice(0, 6).join("\n") }));
  try {
    await db.insert(errorEvents).values({ message: err.message.slice(0, 1000), digest: ctx.digest, path: ctx.path, stack: err.stack?.slice(0, 4000) });
  } catch {}
  const hook = process.env.ERROR_WEBHOOK_URL;
  if (hook) {
    fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `[civic-lens] ${err.message} at ${ctx.path ?? "?"}` }) }).catch(() => {});
  }
}
