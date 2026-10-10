import type { Instrumentation } from "next";

export async function register() {}

/** Server-side error monitoring hook: every unhandled render/route error is reported. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./server/services/errors");
  await reportError(err, { path: request.path, digest: (err as { digest?: string }).digest });
};
