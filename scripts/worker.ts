/**
 * Background worker. Runs scheduled maintenance on an interval:
 *  - ingest candidate stories from INGEST_FEEDS (every 30 min)
 *  - check source links on live stories (every 6 h)
 *  - lift expired restrictions, purge rate-limit rows and old analytics (hourly)
 * Run with `npm run worker`; `--once` runs every job once and exits (for cron).
 */
import { checkSourceLinks, ingestFeeds } from "../src/server/services/ingestion";
import { liftExpiredRestrictions } from "../src/server/services/moderation";
import { purgeRateLimits } from "../src/server/services/rateLimit";
import { purgeOldEvents } from "../src/server/services/analytics";
import { reportError } from "../src/server/services/errors";
import { closeDb } from "../src/server/db";

const MIN = 60_000;
const jobs = [
  { name: "ingest", every: 30 * MIN, run: async () => `${await ingestFeeds()} new candidates` },
  { name: "links", every: 6 * 60 * MIN, run: async () => `${await checkSourceLinks()} links checked` },
  { name: "maintenance", every: 60 * MIN, run: async () => { await liftExpiredRestrictions(); await purgeRateLimits(); await purgeOldEvents(); return "ok"; } },
];

async function runJob(j: (typeof jobs)[number]) {
  try {
    console.log(`[worker] ${j.name}: ${await j.run()}`);
  } catch (e) {
    await reportError(e, { path: `worker:${j.name}` });
  }
}

if (process.argv.includes("--once")) {
  for (const j of jobs) await runJob(j);
  await closeDb();
} else {
  for (const j of jobs) {
    void runJob(j);
    setInterval(() => void runJob(j), j.every);
  }
  console.log("[worker] started");
}
