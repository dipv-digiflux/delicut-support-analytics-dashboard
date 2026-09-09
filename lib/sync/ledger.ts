import { getConfig } from "@/lib/config";
import { collections } from "@/lib/db/client";
import type { ExtractEvent, SyncWindow, WindowStatus } from "@/lib/db/types";
import type { PlannedWindow } from "./planner";
import { needsFetch } from "./planner";

const FETCHABLE_STATUSES: WindowStatus[] = [
  "planned",
  "submitted",
  "ready",
  "failed",
];

export async function upsertPlannedWindows(
  planned: PlannedWindow[],
  runId: string,
): Promise<SyncWindow[]> {
  const { syncWindows } = await collections();
  const results: SyncWindow[] = [];

  for (const p of planned) {
    await syncWindows.updateOne(
      { _id: p._id },
      {
        $set: {
          event: p.event,
          window_start: p.window_start,
          window_end: p.window_end,
          is_hot: p.is_hot,
          last_run_id: runId,
        },
        $setOnInsert: {
          status: "planned" as const,
          freshchat_job_id: null,
          download_links: [],
          links_issued_at: null,
          attempts: 0,
          submitted_at: null,
          ready_at: null,
          merged_at: null,
          row_count: 0,
          rows_inserted: 0,
          rows_updated: 0,
          rows_unchanged: 0,
          content_checksum: null,
          last_error: null,
        },
      },
      { upsert: true },
    );

    // Hot windows always go back to planned so they re-fetch
    if (p.is_hot) {
      await syncWindows.updateOne(
        { _id: p._id, status: { $in: ["merged", "skipped", "failed"] } },
        { $set: { status: "planned", window_end: p.window_end } },
      );
    }

    const doc = await syncWindows.findOne({ _id: p._id });
    if (doc) results.push(doc);
  }

  return results;
}

export type WorkOrder = "asc" | "desc";

function buildWindowFilter(
  event: ExtractEvent | { $in: ExtractEvent[] },
  opts?: {
    since?: Date | null;
    until?: Date | null;
    force?: boolean;
    /** Only failed windows eligible for retry */
    failedOnly?: boolean;
  },
): Record<string, unknown> {
  const cfg = getConfig();
  const maxAttempts = cfg.SYNC_WINDOW_MAX_ATTEMPTS;
  const filter: Record<string, unknown> = { event };
  if (opts?.since || opts?.until) {
    const range: Record<string, Date> = {};
    if (opts.since) range.$gte = opts.since;
    if (opts.until) range.$lt = opts.until;
    filter.window_start = range;
  }
  if (opts?.failedOnly) {
    filter.status = "failed";
    if (!opts.force) {
      filter.attempts = { $lt: maxAttempts };
    }
    return filter;
  }
  if (!opts?.force) {
    filter.$or = [
      {
        status: { $in: FETCHABLE_STATUSES.filter((s) => s !== "failed") },
      },
      { status: "failed", attempts: { $lt: maxAttempts } },
      // Hot days re-fetch only when not already merged this run
      {
        is_hot: true,
        status: { $nin: ["merged", "skipped"] },
      },
    ];
  }
  return filter;
}

export async function selectWorkWindows(
  event: ExtractEvent,
  force = false,
  limit?: number,
  opts?: {
    order?: WorkOrder;
    since?: Date | null;
    until?: Date | null;
    failedOnly?: boolean;
  },
): Promise<SyncWindow[]> {
  const { syncWindows } = await collections();
  const order = opts?.order ?? "asc";
  const filter = buildWindowFilter(event, {
    since: opts?.since,
    until: opts?.until,
    force,
    failedOnly: opts?.failedOnly,
  });

  let cursor = syncWindows
    .find(filter)
    .sort({ window_start: order === "desc" ? -1 : 1 });

  if (typeof limit === "number" && (!force || opts?.failedOnly)) {
    cursor = cursor.limit(limit);
    const rows = await cursor.toArray();
    if (force && !opts?.failedOnly) {
      return rows.filter((w) => needsFetch(w, true)).slice(0, limit);
    }
    return rows;
  }

  const all = await cursor.toArray();
  const work = force ? all.filter((w) => needsFetch(w, true)) : all;
  return typeof limit === "number" ? work.slice(0, limit) : work;
}

/** Count windows still needing fetch in an optional range (index-friendly). */
export async function countPendingWindows(
  events: ExtractEvent[],
  opts?: { since?: Date | null; until?: Date | null; force?: boolean },
): Promise<number> {
  const { syncWindows } = await collections();
  const filter = buildWindowFilter({ $in: events }, opts);
  return syncWindows.countDocuments(filter);
}

/**
 * Re-queue failed windows with attempts left so the next select picks them up.
 * Exhausted windows stay failed until --force.
 */
export async function requeueRetryableFailures(opts: {
  events: ExtractEvent[];
  since?: Date | null;
  until?: Date | null;
  force?: boolean;
}): Promise<number> {
  const cfg = getConfig();
  const { syncWindows } = await collections();
  const filter: Record<string, unknown> = {
    event: { $in: opts.events },
    status: "failed",
  };
  if (opts.since || opts.until) {
    const range: Record<string, Date> = {};
    if (opts.since) range.$gte = opts.since;
    if (opts.until) range.$lt = opts.until;
    filter.window_start = range;
  }
  if (!opts.force) {
    filter.attempts = { $lt: cfg.SYNC_WINDOW_MAX_ATTEMPTS };
  }

  const res = await syncWindows.updateMany(filter, {
    $set: {
      status: "planned",
      freshchat_job_id: null,
      download_links: [],
      last_error: null,
    },
  });
  return res.modifiedCount;
}

export async function markWindow(
  id: string,
  patch: Partial<SyncWindow>,
): Promise<void> {
  const { syncWindows } = await collections();
  await syncWindows.updateOne({ _id: id }, { $set: patch });
}
