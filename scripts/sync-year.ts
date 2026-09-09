#!/usr/bin/env node
/**
 * Year-to-date / full-year backfill helper.
 * Usage: npm run sync:year
 *        npm run sync:year -- --year=2025
 *
 * Respects Extract quotas (120/day/event). Re-run daily until complete.
 */
import { runSync, shutdownSync } from "@/lib/sync/run";

function arg(name: string): string | undefined {
  const eqPrefix = `--${name}=`;
  const eq = process.argv.find((a) => a.startsWith(eqPrefix));
  if (eq) return eq.slice(eqPrefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

async function main() {
  const year = Number(arg("year") || new Date().getUTCFullYear());
  const since = new Date(Date.UTC(year, 0, 1));
  const until = new Date();

  console.log(
    `[sync:year] backfill ${since.toISOString().slice(0, 10)} → ${until.toISOString().slice(0, 10)}`,
  );
  console.log(
    "[sync:year] Tip: Chat-Transcript is ~1 day/job and ~120 jobs/day — multi-day runs expected.",
  );

  const run = await runSync({
    mode: "backfill",
    since,
    until,
    dryRun: process.argv.includes("--dry-run"),
    force: process.argv.includes("--force"),
  });

  await shutdownSync();
  console.log(
    `[sync:year] finished status=${run.status} merged=${run.counters.windows_merged} failed=${run.counters.windows_failed}`,
  );
  if (run.status === "partial") {
    console.log(
      "[sync:year] Partial (likely quota). Run again tomorrow to continue from the ledger.",
    );
  }
  process.exit(run.status === "failed" ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await shutdownSync().catch(() => undefined);
  process.exit(1);
});
