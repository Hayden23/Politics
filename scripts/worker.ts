/**
 * Background worker. Runs scheduled maintenance on an interval:
 *  - publish scheduled stories (every minute)
 *  - queue daily/weekly email digests (hourly, at DIGEST_HOUR_UTC) and send them (every 5 min)
 *  - ingest candidate stories from INGEST_FEEDS (every 30 min)
 *  - check source links on live stories (every 6 h)
 *  - lift expired restrictions, purge rate-limit rows and old analytics (hourly)
 * Run with `npm run worker`; `--once` runs every job once and exits (for cron).
 */
import { checkSourceLinks, ingestFeeds } from "../src/server/services/ingestion";
import { publishDueStories } from "../src/server/services/editorial";
import { queueDigests, sendPendingEmails } from "../src/server/services/notifications";
import { liftExpiredRestrictions } from "../src/server/services/moderation";
import { purgeRateLimits } from "../src/server/services/rateLimit";
import { purgeOldEvents } from "../src/server/services/analytics";
import { reportError } from "../src/server/services/errors";
import { closeDb } from "../src/server/db";

const MIN = 60_000;
const DIGEST_HOUR_UTC = Number(process.env.DIGEST_HOUR_UTC ?? 13);
const jobs = [
  { name: "scheduled-publish", every: 1 * MIN, run: async () => `${(await publishDueStories()).length} published` },
  { name: "digests", every: 60 * MIN, run: async () => (new Date().getUTCHours() === DIGEST_HOUR_UTC ? `${await queueDigests()} digests queued` : "not digest hour") },
  { name: "email", every: 5 * MIN, run: async () => `${await sendPendingEmails()} emails processed` },
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
