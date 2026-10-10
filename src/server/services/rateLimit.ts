import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { tooMany } from "@/lib/errors";

export const LIMITS = {
  login: { limit: 10, windowSec: 600 },
  signup: { limit: 5, windowSec: 3600 },
  rating: { limit: 60, windowSec: 60 },
  comment: { limit: 10, windowSec: 600 },
  reaction: { limit: 120, windowSec: 600 },
  report: { limit: 20, windowSec: 3600 },
  ai: { limit: 30, windowSec: 3600 },
} as const;

/** Fixed-window counter in Postgres so limits hold across app instances. */
export async function rateLimit(bucket: keyof typeof LIMITS, subject: string) {
  if (process.env.RATE_LIMITS === "off") return;
  const { limit, windowSec } = LIMITS[bucket];
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const key = `${bucket}:${subject}`;
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`);
  if (Number(rows[0]?.count ?? 0) > limit) throw tooMany();
}

export async function purgeRateLimits() {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
