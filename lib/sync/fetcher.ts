import fs from "fs/promises";
import path from "path";
import { getConfig } from "@/lib/config";
import {
  submitExtractJob,
  pollExtractJob,
  downloadExtractCsv,
} from "@/lib/freshchat/extract";
import { FreshchatError } from "@/lib/freshchat/errors";
import { contentChecksum } from "@/lib/hash/entity-hash";
import { parseCsv } from "@/lib/parse/csv";
import { markWindow } from "./ledger";
import { mergeTranscriptRows } from "./merge/transcripts";
import { mergeCsatRows } from "./merge/csat";
import { mergeLabelRows } from "./merge/labels";
import { mergeMetricRows } from "./merge/metrics";
import { upsertDiscoveredUsers } from "./enrich-users";
import type { SyncRunCounters, SyncWindow } from "@/lib/db/types";
import type { Logger } from "@/lib/log/logger";
import type { DiscoveredActor } from "./merge/transcripts";

async function ensureCacheDir(): Promise<string> {
  const cfg = getConfig();
  const dir = path.resolve(process.cwd(), cfg.EXTRACT_CACHE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function processWindow(
  window: SyncWindow,
  counters: SyncRunCounters,
  logger: Logger,
  signal: { aborted: boolean },
  dryRun: boolean,
  forceRetry = false,
): Promise<DiscoveredActor[]> {
  const discovered: DiscoveredActor[] = [];

  if (dryRun) {
    logger.info(`[dry-run] would fetch ${window._id}`);
    return discovered;
  }

  try {
    let jobId = window.freshchat_job_id;
    const cfg = getConfig();

    if (
      !forceRetry &&
      window.status === "failed" &&
      (window.attempts || 0) >= cfg.SYNC_WINDOW_MAX_ATTEMPTS
    ) {
      logger.warn(
        `skip ${window._id}: exhausted ${window.attempts}/${cfg.SYNC_WINDOW_MAX_ATTEMPTS} attempts`,
      );
      return discovered;
    }

    if (window.status === "planned" || window.status === "failed" || !jobId) {
      const job = await submitExtractJob(
        window.event,
        window.window_start,
        window.window_end,
        {
          logger,
          onApiCall: () => counters.api_calls++,
          onRateLimit: () => counters.rate_limit_waits++,
        },
      );
      jobId = job.id;
      counters.windows_submitted++;
      await markWindow(window._id, {
        status: "submitted",
        freshchat_job_id: jobId,
        submitted_at: new Date(),
        attempts: (window.attempts || 0) + 1,
        last_error: null,
      });
      window.attempts = (window.attempts || 0) + 1;
    }

    if (signal.aborted) throw new FreshchatError("Aborted", "ABORTED");

    const polled = await pollExtractJob(jobId!, {
      logger,
      signal,
      onApiCall: () => counters.api_calls++,
      onRateLimit: () => counters.rate_limit_waits++,
    });

    await markWindow(window._id, {
      status: "ready",
      download_links: polled.links.map((l) => l.href),
      links_issued_at: new Date(),
      ready_at: new Date(),
    });

    const buf = await downloadExtractCsv(polled.links, {
      logger,
      onApiCall: () => counters.api_calls++,
      onRateLimit: () => counters.rate_limit_waits++,
      repoll: async () =>
        pollExtractJob(jobId!, {
          logger,
          signal,
          onApiCall: () => counters.api_calls++,
          onRateLimit: () => counters.rate_limit_waits++,
        }),
    });

    const checksum = contentChecksum(buf);
    const cacheDir = await ensureCacheDir();
    const cachePath = path.join(
      cacheDir,
      `${window._id.replace(/[|:]/g, "_")}.csv`,
    );
    await fs.writeFile(cachePath, buf);

    const rows = parseCsv(buf);
    logger.info(
      `job ${jobId}: downloaded CSV (${rows.length} rows) → merging`,
    );

    const beforeUnchanged = counters.conversations_unchanged;
    const beforeInserted = counters.conversations_inserted;
    const beforeUpdated = counters.conversations_updated;

    if (window.event === "Chat-Transcript") {
      const result = await mergeTranscriptRows(rows, window._id, counters);
      discovered.push(...result.discovered);
      await upsertDiscoveredUsers(result.discovered, counters);
    } else if (window.event === "CSAT-Score") {
      await mergeCsatRows(rows, window._id, counters);
    } else if (window.event === "Conversation-Resolution-Label") {
      await mergeLabelRows(rows, window._id, counters);
    } else {
      await mergeMetricRows(window.event, rows, window._id, counters);
    }

    await markWindow(window._id, {
      status: "merged",
      merged_at: new Date(),
      row_count: rows.length,
      content_checksum: checksum,
      rows_inserted: counters.conversations_inserted - beforeInserted,
      rows_updated: counters.conversations_updated - beforeUpdated,
      rows_unchanged: counters.conversations_unchanged - beforeUnchanged,
      last_error: null,
    });
    counters.windows_merged++;
  } catch (err) {
    if (err instanceof FreshchatError && err.code === "QUOTA_EXHAUSTED") {
      logger.warn(err.message);
      throw err;
    }
    if (err instanceof FreshchatError && err.fatal) throw err;

    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof FreshchatError ? err.code : "WINDOW_FAILED";
    logger.error(`window ${window._id} failed: ${message}`);
    await markWindow(window._id, {
      status: "failed",
      last_error: { code, message, at: new Date() },
    });
    counters.windows_failed++;
  }

  return discovered;
}
