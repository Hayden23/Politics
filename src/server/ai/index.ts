import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { HttpError } from "@/lib/errors";
import { AnthropicDraftProvider } from "./anthropic";
import { MockDraftProvider } from "./mock";
import type { DraftInput, DraftProvider, DraftResult } from "./types";

export * from "./types";

/**
 * Provider-agnostic entry point. AI_PROVIDER selects the implementation:
 *   anthropic (default when ANTHROPIC_API_KEY is set) | mock (tests only; refuses in production)
 * With no provider configured, drafting is unavailable and editors write by hand.
 */
export function draftProvider(): DraftProvider | null {
  const choice = process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "none");
  if (choice === "anthropic") return new AnthropicDraftProvider();
  if (choice === "mock") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AI !== "true") return null;
    return new MockDraftProvider();
  }
  return null;
}

const DAILY_LIMIT = () => Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 200);

/** Enforces the daily cost ceiling and records usage. */
export async function generateDraft(input: DraftInput): Promise<DraftResult> {
  const provider = draftProvider();
  if (!provider) throw new HttpError(503, "AI drafting is not configured. Set ANTHROPIC_API_KEY or write the draft manually.", "ai_unavailable");
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db.execute<{ requests: number }>(sql`
    INSERT INTO ai_usage (day, requests) VALUES (${day}, 1)
    ON CONFLICT (day) DO UPDATE SET requests = ai_usage.requests + 1 RETURNING requests`);
  if (Number(row?.requests ?? 0) > DAILY_LIMIT()) throw new HttpError(429, "The daily AI drafting limit has been reached", "ai_limit");
  let result: DraftResult;
  try {
    result = await provider.draft(input);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, (e as Error).message || "AI drafting failed", "ai_failed");
  }
  await db.execute(sql`UPDATE ai_usage SET input_tokens = input_tokens + ${result.usage.inputTokens}, output_tokens = output_tokens + ${result.usage.outputTokens} WHERE day = ${day}`);
  return result;
}
