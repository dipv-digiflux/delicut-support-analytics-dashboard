#!/usr/bin/env node
/**
 * Print sync campaign + Extract quota progress (read-only).
 *
 *   npm run sync:status
 *   npm run sync:status -- --id=dubai-2026-ytd
 */
import { getConfig } from "@/lib/config";
import { closeMongo, collections } from "@/lib/db/client";
import { remainingQuota } from "@/lib/freshchat/budget";
import {
  campaignPct,
  getCampaign,
  getLatestCampaign,
} from "@/lib/sync/campaign";

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
  const cfg = getConfig();
  const id = arg("id");
  const campaign = id ? await getCampaign(id) : await getLatestCampaign();
  const { syncRuns, conversations } = await collections();
  const latestRun = await syncRuns
    .find({})
    .sort({ started_at: -1 })
    .limit(1)
    .next();
  const convCount = await conversations.estimatedDocumentCount();
  const transcriptQuota = await remainingQuota("Chat-Transcript");

  console.log(`[sync:status] db=${cfg.MONGODB_DB}`);
  console.log(`[sync:status] conversations≈${convCount}`);
  console.log(
    `[sync:status] Chat-Transcript quota left today: ${transcriptQuota}/${cfg.EXTRACT_MAX_JOBS_PER_DAY}`,
  );

  if (latestRun) {
    console.log(
      `[sync:status] last run: ${latestRun.status} started=${latestRun.started_at.toISOString()} finished=${latestRun.finished_at?.toISOString() ?? "—"}`,
    );
  } else {
    console.log("[sync:status] last run: never");
  }

  if (!campaign) {
    console.log("[sync:status] no campaign yet — run npm run sync:campaign …");
    await closeMongo();
    return;
  }

  const pct = campaignPct(campaign.stats);
  console.log(
    `[sync:status] campaign ${campaign._id}: ${campaign.status} ${pct}%`,
  );
  console.log(
    `  range: ${campaign.since.toISOString()} → ${campaign.until.toISOString()} order=${campaign.order}`,
  );
  console.log(
    `  windows: merged ${campaign.stats.merged}/${campaign.stats.total} pending ${campaign.stats.pending} failed ${campaign.stats.failed}`,
  );
  const cp = campaign.checkpoint;
  if (cp) {
    console.log(
      `  checkpoint: next=${cp.next_window_start?.toISOString() ?? "—"} newest_merged=${cp.newest_merged_start?.toISOString() ?? "—"} oldest_pending=${cp.oldest_pending_start?.toISOString() ?? "—"} transcript_days_left=${cp.pending_transcript_days}`,
    );
  }
  for (const [event, s] of Object.entries(campaign.stats.by_event)) {
    if (!s) continue;
    console.log(
      `  - ${event}: merged ${s.merged}/${s.total} pending ${s.pending} failed ${s.failed}`,
    );
  }
  if (campaign.status === "paused_quota") {
    console.log(
      "  next: re-run the same sync:campaign command after UTC day resets quota — resume starts at checkpoint (merged days skipped)",
    );
  }

  await closeMongo();
}

main().catch(async (err) => {
  console.error("[sync:status] fatal:", err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
