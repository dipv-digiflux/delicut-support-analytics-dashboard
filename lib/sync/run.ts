import os from "os";
import { ulid } from "ulid";
import { getConfig, requireFreshchatConfig } from "@/lib/config";
import { collections, closeMongo, getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { emptyCounters, type ExtractEvent, type SyncRun } from "@/lib/db/types";
import { createLogger } from "@/lib/log/logger";
import { FreshchatError } from "@/lib/freshchat/errors";
import { remainingQuota } from "@/lib/freshchat/budget";
import {
  planWindows,
  applyOverlap,
} from "./planner";
import { ensureCursor, advanceCursor } from "./cursor";
import {
  upsertPlannedWindows,
  selectWorkWindows,
  countPendingWindows,
  requeueRetryableFailures,
  type WorkOrder,
} from "./ledger";
import { processWindow } from "./fetcher";
import { enrichUsers } from "./enrich-users";
import { classifyPending } from "./classify-phase";
import { addUtcDays, startOfUtcDay } from "@/lib/normalize/dates";

export interface SyncOptions {
  mode?: "backfill" | "incremental" | "repair";
  lookbackDays?: number;
  since?: Date | null;
  until?: Date | null;
  dryRun?: boolean;
  force?: boolean;
  events?: ExtractEvent[];
  /** Window fetch order. Default asc (oldest first). Campaigns use desc. */
  order?: WorkOrder;
}

export interface SyncRunResult extends SyncRun {
  /** True when Extract daily quota stopped further posts this run. */
  quota_stopped: boolean;
}

export async function runSync(options: SyncOptions = {}): Promise<SyncRunResult> {
  const cfg = requireFreshchatConfig();
  const runId = ulid();
  const logger = createLogger(runId);
  // Prune old logs once per sync start (cheap)
  if (cfg.LOG_TO_FILE) {
    const pruned = (await import("@/lib/log/logger")).pruneOldLogs();
    if (pruned.deleted.length) {
      logger.info(
        `log prune: removed ${pruned.deleted.length} old file(s), kept ${pruned.kept}`,
      );
    }
    logger.info(`logging to file: ${logger.getFilePaths().join(", ")}`);
  }

  const mode = options.mode || "incremental";
  const lookback = options.lookbackDays ?? cfg.SYNC_LOOKBACK_DAYS;
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const events = options.events ?? cfg.syncEvents;
  const workOrder: WorkOrder = options.order ?? "asc";
  const now = new Date();
  const until = options.until ?? now;
  const sinceParam = options.since ?? null;
  let quotaStopped = false;

  const { syncRuns } = await collections();
  await ensureIndexes(await getDb());

  const run: SyncRun = {
    _id: runId,
    mode,
    started_at: now,
    finished_at: null,
    status: "running",
    params: {
      lookback_days: lookback,
      events,
      dry_run: dryRun,
      since: sinceParam,
      until,
      order: workOrder,
    },
    counters: emptyCounters(),
    errors: [],
    host: os.hostname(),
    git_sha: process.env.GIT_SHA || null,
  };
  await syncRuns.insertOne(run);

  const signal = { aborted: false };
  const onSignal = () => {
    signal.aborted = true;
    logger.warn("interrupt received — finishing current window then aborting");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  const startedMs = Date.now();

  try {
    logger.info(
      `start mode=${mode} lookback=${lookback}d order=${workOrder} dryRun=${dryRun} events=${events.join(",")}`,
    );

    if (!dryRun) {
      const requeued = await requeueRetryableFailures({
        events,
        since: sinceParam,
        until,
        force,
      });
      if (requeued > 0) {
        logger.info(
          `re-queued ${requeued} failed window(s) for retry (attempts < ${cfg.SYNC_WINDOW_MAX_ATTEMPTS})`,
        );
      }
    }

    // PLAN
    for (const event of events) {
      const cursor = await ensureCursor(event);
      let from: Date;
      if (sinceParam) {
        from = sinceParam;
      } else if (mode === "backfill" || !cursor.last_successful_end) {
        from = addUtcDays(startOfUtcDay(now), -lookback);
      } else {
        from = applyOverlap(cursor.last_successful_end, event);
      }

      const planned = planWindows({ event, from, until, now });
      logger.info(
        `PLAN ${event}: ${planned.length} windows (${from.toISOString()} → ${until.toISOString()})`,
      );
      await upsertPlannedWindows(planned, runId);
      run.counters.windows_planned += planned.length;
    }

    // FETCH + MERGE (transcripts first, then labels, then csat)
    const eventOrder: ExtractEvent[] = [
      "Chat-Transcript",
      "Conversation-Created",
      "Conversation-Resolved",
      "Conversation-Resolution-Label",
      "CSAT-Score",
      "First-Response-Time",
      "Resolution-Time",
      "Response-Time",
      "Message-Sent",
    ].filter((e) => events.includes(e as ExtractEvent)) as ExtractEvent[];

    for (const event of eventOrder) {
      if (signal.aborted) break;

      const quota = await remainingQuota(event);
      const work = await selectWorkWindows(event, force, quota, {
        order: workOrder,
        since: sinceParam,
        until,
      });
      logger.info(
        `FETCH ${event}: ${work.length} windows to process (quota left ${quota}, order=${workOrder})`,
      );

      for (let i = 0; i < work.length; i++) {
        const window = work[i]!;
        if (signal.aborted) break;
        const day = window.window_start.toISOString().slice(0, 10);
        logger.info(
          `→ [${i + 1}/${work.length}] ${event} ${day} (${window.status}, attempts=${window.attempts || 0})`,
        );
        try {
          await processWindow(window, run.counters, logger, signal, dryRun);
        } catch (err) {
          if (err instanceof FreshchatError && err.code === "QUOTA_EXHAUSTED") {
            quotaStopped = true;
            logger.warn(`stopping ${event}: ${err.message}`);
            break;
          }
          if (err instanceof FreshchatError && err.fatal) throw err;
          const message = err instanceof Error ? err.message : String(err);
          run.errors.push({
            code: err instanceof FreshchatError ? err.code : "ERROR",
            message,
            context: window._id,
            at: new Date(),
          });
        }
      }

      // In-run retry pass for failures (uses leftover quota)
      if (
        !dryRun &&
        !signal.aborted &&
        !quotaStopped &&
        cfg.SYNC_RETRY_FAILED_IN_RUN
      ) {
        const retryQuota = await remainingQuota(event);
        if (retryQuota > 0) {
          const retries = await selectWorkWindows(event, force, retryQuota, {
            order: workOrder,
            since: sinceParam,
            until,
            failedOnly: true,
          });
          if (retries.length) {
            logger.info(
              `RETRY ${event}: ${retries.length} failed window(s) (quota left ${retryQuota})`,
            );
            for (let i = 0; i < retries.length; i++) {
              const window = retries[i]!;
              if (signal.aborted) break;
              logger.info(
                `↻ retry [${i + 1}/${retries.length}] ${event} ${window.window_start.toISOString().slice(0, 10)}`,
              );
              try {
                await processWindow(
                  window,
                  run.counters,
                  logger,
                  signal,
                  dryRun,
                  true,
                );
              } catch (err) {
                if (
                  err instanceof FreshchatError &&
                  err.code === "QUOTA_EXHAUSTED"
                ) {
                  quotaStopped = true;
                  logger.warn(`stopping retry ${event}: ${err.message}`);
                  break;
                }
                if (err instanceof FreshchatError && err.fatal) throw err;
              }
            }
          }
        }
      }

      // After processing, if we took fewer than available due to quota cap
      if (!quotaStopped && quota === 0) {
        const stillPending = await countPendingWindows([event], {
          since: sinceParam,
          until,
          force,
        });
        if (stillPending > 0) quotaStopped = true;
      } else if (!quotaStopped) {
        const stillPending = await countPendingWindows([event], {
          since: sinceParam,
          until,
          force,
        });
        if (stillPending > 0 && work.length >= quota && quota > 0) {
          quotaStopped = true;
          logger.warn(
            `${event}: daily quota consumed with ${stillPending} window(s) still pending`,
          );
        }
      }

      // Cursor assumes contiguous oldest→newest prefix; skip in reverse/backfill
      if (!dryRun && mode === "incremental" && workOrder === "asc") {
        await advanceCursor(event);
      }
    }

    if (!dryRun && !signal.aborted) {
      logger.info("ENRICH users…");
      await enrichUsers(run.counters, logger);
      logger.info("CLASSIFY…");
      await classifyPending(run.counters, logger);
    }

    const pendingLeft = await countPendingWindows(events, {
      since: sinceParam,
      until,
      force,
    });

    if (signal.aborted) {
      run.status = "aborted";
    } else if (run.counters.windows_failed > 0 || pendingLeft > 0 || quotaStopped) {
      run.status = "partial";
      if (pendingLeft > 0) {
        logger.warn(
          `${pendingLeft} window(s) still pending in range — re-run to continue`,
        );
      }
    } else {
      run.status = "completed";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`FATAL: ${message}`);
    run.status = "failed";
    run.errors.push({
      code: err instanceof FreshchatError ? err.code : "FATAL",
      message,
      context: "run",
      at: new Date(),
    });
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    run.finished_at = new Date();
    await syncRuns.updateOne(
      { _id: runId },
      {
        $set: {
          status: run.status,
          finished_at: run.finished_at,
          counters: run.counters,
          errors: run.errors,
        },
      },
    );

    const elapsed = ((Date.now() - startedMs) / 1000).toFixed(1);
    logger.info(
      `DONE in ${elapsed}s — status=${run.status} quota_stopped=${quotaStopped} created:${run.counters.conversations_inserted} updated:${run.counters.conversations_updated} unchanged:${run.counters.conversations_unchanged} errors:${run.errors.length + run.counters.windows_failed}`,
    );
    if (logger.getFilePaths().length) {
      logger.info(`log files: ${logger.getFilePaths().join(" | ")}`);
    }
    await logger.close();
  }

  return { ...run, quota_stopped: quotaStopped };
}

export async function shutdownSync(): Promise<void> {
  await closeMongo();
}
