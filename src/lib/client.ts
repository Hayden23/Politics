"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** JSON fetch for client components. Throws ApiError with the server's message. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body ? { "content-type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, typeof navigator !== "undefined" && !navigator.onLine ? "You're offline. Check your connection and try again." : "Network error. Please try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong", data.code);
  return data as T;
}

export function sendEvent(name: "story_shared" | "perspective_explored", storyId?: string, props?: Record<string, string>) {
  api("/api/events", { body: { name, storyId, props } }).catch(() => {});
}
