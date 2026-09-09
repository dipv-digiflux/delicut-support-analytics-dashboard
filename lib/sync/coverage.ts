import pc from "picocolors";
import { collections } from "@/lib/db/client";
import type { ExtractEvent, WindowStatus } from "@/lib/db/types";

export interface CollectionCoverage {
  name: string;
  count: number;
  from: Date | null;
  to: Date | null;
}

export interface FailedWindowSummary {
  _id: string;
  event: ExtractEvent;
  window_start: Date;
  window_end: Date;
  attempts: number;
  error: string | null;
}

export interface DbCoverageReport {
  collections: CollectionCoverage[];
  conversationsInRange: number;
  windowsByStatus: Record<string, number>;
  failed: FailedWindowSummary[];
  exhaustedAttempts: FailedWindowSummary[];
  missingTranscriptDays: number;
  campaign?: {
    id: string;
    since: Date;
    until: Date;
    pending: number;
    merged: number;
    failed: number;
    total: number;
  };
}

function ymd(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

/** Snapshot of what Mongo already holds + gaps for an optional campaign range. */
export async function getDbCoverage(opts?: {
  since?: Date;
  until?: Date;
  campaignId?: string;
  maxFailedList?: number;
  maxAttempts?: number;
}): Promise<DbCoverageReport> {
  const { conversations, users, syncWindows, syncCampaigns } =
    await collections();
  const maxFailed = opts?.maxFailedList ?? 8;
  const maxAttempts = opts?.maxAttempts ?? 5;

  const [convCount, userCount, agentCount, convBounds, rangeConvCount] =
    await Promise.all([
      conversations.estimatedDocumentCount(),
      users.countDocuments({ role: "user" }),
      users.countDocuments({ role: { $in: ["agent"] } }),
      conversations
        .aggregate<{ min: Date | null; max: Date | null }>([
          {
            $group: {
              _id: null,
              min: { $min: "$created_at" },
              max: { $max: "$created_at" },
            },
          },
          { $project: { _id: 0, min: 1, max: 1 } },
        ])
        .next(),
      opts?.since && opts?.until
        ? conversations.countDocuments({
            created_at: { $gte: opts.since, $lt: opts.until },
          })
        : Promise.resolve(0),
    ]);

  const collectionsReport: CollectionCoverage[] = [
    {
      name: "conversations",
      count: convCount,
      from: convBounds?.min ?? null,
      to: convBounds?.max ?? null,
    },
    {
      name: "users (customers)",
      count: userCount,
      from: null,
      to: null,
    },
    {
      name: "users (agents)",
      count: agentCount,
      from: null,
      to: null,
    },
  ];

  const statusRows = await syncWindows
    .aggregate<{ _id: WindowStatus; n: number }>([
      ...(opts?.since && opts?.until
        ? [
            {
              $match: {
                window_start: { $gte: opts.since, $lt: opts.until },
              },
            },
          ]
        : []),
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ])
    .toArray();

  const windowsByStatus: Record<string, number> = {};
  for (const r of statusRows) windowsByStatus[r._id] = r.n;

  const failedFilter: Record<string, unknown> = { status: "failed" };
  if (opts?.since && opts?.until) {
    failedFilter.window_start = { $gte: opts.since, $lt: opts.until };
  }

  const failedDocs = await syncWindows
    .find(failedFilter)
    .sort({ window_start: -1 })
    .limit(50)
    .toArray();

  const failed: FailedWindowSummary[] = [];
  const exhaustedAttempts: FailedWindowSummary[] = [];
  for (const w of failedDocs) {
    const row: FailedWindowSummary = {
      _id: w._id,
      event: w.event,
      window_start: w.window_start,
      window_end: w.window_end,
      attempts: w.attempts || 0,
      error: w.last_error?.message ?? null,
    };
    if ((w.attempts || 0) >= maxAttempts) exhaustedAttempts.push(row);
    else failed.push(row);
  }

  // Missing = Chat-Transcript windows in range that are not merged/skipped
  let missingTranscriptDays = 0;
  if (opts?.since && opts?.until) {
    missingTranscriptDays = await syncWindows.countDocuments({
      event: "Chat-Transcript",
      window_start: { $gte: opts.since, $lt: opts.until },
      status: { $nin: ["merged", "skipped"] },
    });
  }

  let campaign: DbCoverageReport["campaign"];
  if (opts?.campaignId) {
    const c = await syncCampaigns.findOne({ _id: opts.campaignId });
    if (c) {
      campaign = {
        id: c._id,
        since: c.since,
        until: c.until,
        pending: c.stats.pending,
        merged: c.stats.merged,
        failed: c.stats.failed,
        total: c.stats.total,
      };
    }
  }

  return {
    collections: collectionsReport,
    conversationsInRange: rangeConvCount,
    windowsByStatus,
    failed: failed.slice(0, maxFailed),
    exhaustedAttempts: exhaustedAttempts.slice(0, maxFailed),
    missingTranscriptDays,
    campaign,
  };
}

/** Pretty TTY banner for campaign CLI / status. */
export function printCoverageReport(
  report: DbCoverageReport,
  opts: {
    title: string;
    addingSince?: Date;
    addingUntil?: Date;
    quotaLeft?: number;
  },
): void {
  const line = (s: string) => console.log(s);
  line("");
  line(pc.bold(pc.cyan(`═══ ${opts.title} ═══`)));
  line(pc.dim("Collections in Mongo:"));
  for (const c of report.collections) {
    const span =
      c.from || c.to ? `  data ${ymd(c.from)} → ${ymd(c.to)}` : "";
    line(`  • ${c.name}: ${pc.bold(String(c.count))}${span}`);
  }

  if (opts.addingSince && opts.addingUntil) {
    line("");
    line(
      pc.bold(
        `This run will fill: ${ymd(opts.addingSince)} → ${ymd(opts.addingUntil)} (exclusive end)`,
      ),
    );
    line(
      `  conversations already in that range: ${pc.bold(String(report.conversationsInRange))}`,
    );
    line(
      `  transcript days still missing/pending: ${pc.bold(String(report.missingTranscriptDays))}`,
    );
    const statusBits = Object.entries(report.windowsByStatus)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    if (statusBits) line(pc.dim(`  sync_windows in range: ${statusBits}`));
  }

  if (typeof opts.quotaLeft === "number") {
    line(`  Chat-Transcript quota left today: ${pc.bold(String(opts.quotaLeft))}`);
  }

  if (report.failed.length) {
    line("");
    line(pc.yellow(`Failed windows (will retry if attempts left):`));
    for (const f of report.failed) {
      line(
        `  • ${f.event} ${ymd(f.window_start)} attempts=${f.attempts} ${f.error ? `— ${f.error.slice(0, 80)}` : ""}`,
      );
    }
  }
  if (report.exhaustedAttempts.length) {
    line("");
    line(
      pc.red(
        `Exhausted retries (need --force or raise SYNC_WINDOW_MAX_ATTEMPTS):`,
      ),
    );
    for (const f of report.exhaustedAttempts) {
      line(
        `  • ${f.event} ${ymd(f.window_start)} attempts=${f.attempts} ${f.error ? `— ${f.error.slice(0, 80)}` : ""}`,
      );
    }
  }
  line(pc.cyan("═══════════════════════════════"));
  line("");
}
