import { collections } from "@/lib/db/client";
import type { Filter } from "mongodb";
import type {
  ExtractEvent,
  SyncCampaign,
  SyncCampaignCheckpoint,
  SyncCampaignEventStats,
  SyncCampaignStats,
  SyncCampaignStatus,
  SyncWindow,
  WindowStatus,
} from "@/lib/db/types";

const PENDING_STATUSES: WindowStatus[] = [
  "planned",
  "submitted",
  "ready",
  "failed",
];

function emptyEventStats(): SyncCampaignEventStats {
  return { total: 0, merged: 0, failed: 0, pending: 0 };
}

export function emptyCampaignStats(): SyncCampaignStats {
  return {
    total: 0,
    merged: 0,
    failed: 0,
    pending: 0,
    by_event: {},
  };
}

export function emptyCheckpoint(): SyncCampaignCheckpoint {
  return {
    next_window_start: null,
    newest_merged_start: null,
    oldest_pending_start: null,
    pending_transcript_days: 0,
  };
}

function resolveCampaignStatus(opts: {
  stats: SyncCampaignStats;
  quotaStopped?: boolean;
  runFailed?: boolean;
}): SyncCampaignStatus {
  const { stats, quotaStopped, runFailed } = opts;
  if (runFailed) return "failed";
  if (stats.pending === 0) {
    return stats.failed > 0 ? "failed" : "completed";
  }
  // Backlog remains — treat as quota pause (re-run same command next day)
  if (quotaStopped || stats.pending > 0) {
    if (stats.failed > 0 && stats.pending === stats.failed && !quotaStopped) {
      return "failed";
    }
    return "paused_quota";
  }
  return "running";
}

export async function upsertCampaign(opts: {
  id: string;
  since: Date;
  until: Date;
  order: "asc" | "desc";
  events: ExtractEvent[];
}): Promise<SyncCampaign> {
  const { syncCampaigns } = await collections();
  const now = new Date();
  await syncCampaigns.updateOne(
    { _id: opts.id },
    {
      $set: {
        since: opts.since,
        until: opts.until,
        order: opts.order,
        events: opts.events,
        updated_at: now,
      },
      $setOnInsert: {
        status: "running" as SyncCampaignStatus,
        stats: emptyCampaignStats(),
        checkpoint: emptyCheckpoint(),
        last_run_id: null,
        quota_stopped: false,
        created_at: now,
      },
    },
    { upsert: true },
  );
  const doc = await syncCampaigns.findOne({ _id: opts.id });
  if (!doc) throw new Error(`Failed to upsert campaign ${opts.id}`);
  return doc;
}

/** Resume pointer from Chat-Transcript ledger (merged days are never re-fetched). */
export async function computeCheckpoint(
  since: Date,
  until: Date,
  order: "asc" | "desc",
): Promise<SyncCampaignCheckpoint> {
  const { syncWindows } = await collections();
  const base = {
    event: "Chat-Transcript" as const,
    window_start: { $gte: since, $lt: until },
  };

  const pendingFilter: Filter<SyncWindow> = {
    ...base,
    $or: [{ status: { $in: PENDING_STATUSES } }, { is_hot: true }],
  };

  const nextPending = await syncWindows
    .find(pendingFilter)
    .sort({ window_start: order === "desc" ? -1 : 1 })
    .project({ window_start: 1 })
    .limit(1)
    .next();

  const oldestPending = await syncWindows
    .find(pendingFilter)
    .sort({ window_start: 1 })
    .project({ window_start: 1 })
    .limit(1)
    .next();

  const newestMerged = await syncWindows
    .find({
      ...base,
      status: { $in: ["merged", "skipped"] },
    })
    .sort({ window_start: -1 })
    .project({ window_start: 1 })
    .limit(1)
    .next();

  const pending_transcript_days = await syncWindows.countDocuments(pendingFilter);

  return {
    next_window_start: nextPending?.window_start ?? null,
    newest_merged_start: newestMerged?.window_start ?? null,
    oldest_pending_start: oldestPending?.window_start ?? null,
    pending_transcript_days,
  };
}

/** Aggregate ledger counts for a campaign range (uses event+window_start index). */
export async function computeCampaignStats(
  events: ExtractEvent[],
  since: Date,
  until: Date,
): Promise<SyncCampaignStats> {
  const { syncWindows } = await collections();
  const rows = await syncWindows
    .aggregate<{
      _id: { event: ExtractEvent; status: string };
      n: number;
    }>([
      {
        $match: {
          event: { $in: events },
          window_start: { $gte: since, $lt: until },
        },
      },
      {
        $group: {
          _id: { event: "$event", status: "$status" },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const stats = emptyCampaignStats();
  for (const row of rows) {
    const event = row._id.event;
    const status = row._id.status;
    let ev = stats.by_event[event];
    if (!ev) {
      ev = emptyEventStats();
      stats.by_event[event] = ev;
    }
    ev.total += row.n;
    stats.total += row.n;
    if (status === "merged" || status === "skipped") {
      ev.merged += row.n;
      stats.merged += row.n;
    } else if (status === "failed") {
      ev.failed += row.n;
      stats.failed += row.n;
      ev.pending += row.n;
      stats.pending += row.n;
    } else {
      ev.pending += row.n;
      stats.pending += row.n;
    }
  }
  return stats;
}

export async function refreshCampaignStats(opts: {
  id: string;
  lastRunId?: string | null;
  quotaStopped?: boolean;
  runFailed?: boolean;
}): Promise<SyncCampaign> {
  const { syncCampaigns } = await collections();
  const campaign = await syncCampaigns.findOne({ _id: opts.id });
  if (!campaign) throw new Error(`Campaign ${opts.id} not found`);

  const stats = await computeCampaignStats(
    campaign.events,
    campaign.since,
    campaign.until,
  );
  const checkpoint = await computeCheckpoint(
    campaign.since,
    campaign.until,
    campaign.order,
  );
  const status = resolveCampaignStatus({
    stats,
    quotaStopped: opts.quotaStopped,
    runFailed: opts.runFailed,
  });

  await syncCampaigns.updateOne(
    { _id: opts.id },
    {
      $set: {
        stats,
        checkpoint,
        status,
        quota_stopped: Boolean(opts.quotaStopped),
        last_run_id: opts.lastRunId ?? campaign.last_run_id,
        updated_at: new Date(),
      },
    },
  );

  const updated = await syncCampaigns.findOne({ _id: opts.id });
  if (!updated) throw new Error(`Campaign ${opts.id} missing after refresh`);
  return updated;
}

export async function getCampaign(id: string): Promise<SyncCampaign | null> {
  const { syncCampaigns } = await collections();
  return syncCampaigns.findOne({ _id: id });
}

export async function getLatestActiveCampaign(): Promise<SyncCampaign | null> {
  const { syncCampaigns } = await collections();
  return syncCampaigns
    .find({ status: { $in: ["running", "paused_quota", "failed"] } })
    .sort({ updated_at: -1 })
    .limit(1)
    .next();
}

export async function getLatestCampaign(): Promise<SyncCampaign | null> {
  const { syncCampaigns } = await collections();
  return syncCampaigns.find({}).sort({ updated_at: -1 }).limit(1).next();
}

export function campaignPct(stats: SyncCampaignStats): number {
  if (stats.total <= 0) return 0;
  return Math.round((stats.merged / stats.total) * 100);
}
