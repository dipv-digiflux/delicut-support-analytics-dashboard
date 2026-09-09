#!/usr/bin/env node
/**
 * Multi-day reverse backfill campaign.
 *
 * Plans the full [since, until) range once, fetches newest-first, stops at
 * Extract daily quota (~120 Chat-Transcript jobs/day). Re-run the same
 * command next day until campaign status is completed.
 *
 * Example (Dubai 1 Jan 2026 → 9 Sep 2026 EOD):
 *   npm run sync:campaign -- \
 *     --id=dubai-2026-ytd \
 *     --since=2025-12-31T20:00:00.000Z \
 *     --until=2026-09-09T20:00:00.000Z \
 *     --order=desc
 */
import { getConfig, requireFreshchatConfig } from "@/lib/config";
import type { ExtractEvent } from "@/lib/db/types";
import { getDb, closeMongo } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { remainingQuota } from "@/lib/freshchat/budget";
import {
  upsertCampaign,
  refreshCampaignStats,
  campaignPct,
} from "@/lib/sync/campaign";
import { getDbCoverage, printCoverageReport } from "@/lib/sync/coverage";
import { runSync, shutdownSync } from "@/lib/sync/run";
import type { WorkOrder } from "@/lib/sync/ledger";

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

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  requireFreshchatConfig();
  const cfg = getConfig();

  const id = arg("id") || "dubai-2026-ytd";
  const sinceRaw = arg("since");
  const untilRaw = arg("until");
  if (!sinceRaw || !untilRaw) {
    console.error(
      "[sync:campaign] Required: --since=ISO --until=ISO (and optional --id=… --order=desc)",
    );
    process.exit(2);
  }

  const since = new Date(sinceRaw);
  const until = new Date(untilRaw);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    console.error("[sync:campaign] Invalid --since / --until");
    process.exit(2);
  }
  if (since >= until) {
    console.error("[sync:campaign] --since must be before --until");
    process.exit(2);
  }

  const order = (arg("order") as WorkOrder | undefined) || "desc";
  const eventsRaw = arg("events");
  const events = eventsRaw
    ? (eventsRaw.split(",") as ExtractEvent[])
    : cfg.syncEvents;

  await ensureIndexes(await getDb());

  const campaign = await upsertCampaign({
    id,
    since,
    until,
    order,
    events,
  });

  const quotaBefore = await remainingQuota("Chat-Transcript");
  const before = await getDbCoverage({
    since,
    until,
    campaignId: id,
    maxAttempts: cfg.SYNC_WINDOW_MAX_ATTEMPTS,
  });
  printCoverageReport(before, {
    title: `BEFORE campaign ${id}`,
    addingSince: since,
    addingUntil: until,
    quotaLeft: quotaBefore,
  });
  console.log(
    "[sync:campaign] Tip: merged windows are skipped — safe to re-run. Do not db:reset mid-campaign.",
  );

  const run = await runSync({
    mode: "backfill",
    since,
    until,
    order,
    events,
    dryRun: hasFlag("dry-run"),
    force: hasFlag("force"),
  });

  const updated = await refreshCampaignStats({
    id,
    lastRunId: run._id,
    quotaStopped: run.quota_stopped,
    runFailed: run.status === "failed",
  });

  const after = await getDbCoverage({
    since,
    until,
    campaignId: id,
    maxAttempts: cfg.SYNC_WINDOW_MAX_ATTEMPTS,
  });
  printCoverageReport(after, {
    title: `AFTER campaign ${id}`,
    addingSince: since,
    addingUntil: until,
    quotaLeft: await remainingQuota("Chat-Transcript"),
  });

  const pct = campaignPct(updated.stats);
  console.log(
    `[sync:campaign] progress ${pct}% — merged ${updated.stats.merged}/${updated.stats.total} pending ${updated.stats.pending} failed ${updated.stats.failed}`,
  );
  const cp = updated.checkpoint;
  if (cp?.next_window_start) {
    console.log(
      `[sync:campaign] checkpoint: next fetch from ${cp.next_window_start.toISOString()} (${cp.pending_transcript_days} transcript day(s) left)`,
    );
  }
  console.log(`[sync:campaign] status=${updated.status} run=${run.status}`);

  if (updated.status === "paused_quota") {
    console.log(
      "[sync:campaign] Quota pause — re-run the SAME command tomorrow. Already-merged older days are skipped (checkpoint resume).",
    );
  } else if (updated.status === "completed") {
    console.log("[sync:campaign] Campaign complete.");
  } else if (updated.status === "failed") {
    console.log(
      "[sync:campaign] Campaign has failures — inspect sync_windows / logs, then re-run (use --force only for specific repairs).",
    );
  }

  await shutdownSync();
  process.exit(run.status === "failed" || updated.status === "failed" ? 1 : 0);
}

main().catch(async (err) => {
  console.error("[sync:campaign] fatal:", err);
  await shutdownSync().catch(() => undefined);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
