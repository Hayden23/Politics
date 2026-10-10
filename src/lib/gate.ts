import "server-only";
import { notFound, redirect } from "next/navigation";
import { HttpError } from "./errors";

/** Runs a post-rating loader; sends people who haven't answered back to the briefing. */
export async function gated<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    if (e instanceof HttpError && e.status === 403) redirect(`/stories/${slug}`);
    throw e;
  }
}
