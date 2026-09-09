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
import { upsertPlannedWindows, selectWorkWindows } from "./ledger";
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
}

export async function runSync(options: SyncOptions = {}): Promise<SyncRun> {
  const cfg = requireFreshchatConfig();
  const logger = createLogger();
  const runId = ulid();
  logger.setRunId(runId);

  const mode = options.mode || "incremental";
  const lookback = options.lookbackDays ?? cfg.SYNC_LOOKBACK_DAYS;
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const events = options.events ?? cfg.syncEvents;
  const now = new Date();
  const until = options.until ?? now;

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
      since: options.since ?? null,
      until,
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
      `start mode=${mode} lookback=${lookback}d dryRun=${dryRun} events=${events.join(",")}`,
    );

    // PLAN
    for (const event of events) {
      const cursor = await ensureCursor(event);
      let from: Date;
      if (options.since) {
        from = options.since;
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
    const order: ExtractEvent[] = [
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

    for (const event of order) {
      if (signal.aborted) break;

      const quota = await remainingQuota(event);
      const work = await selectWorkWindows(event, force, quota);
      logger.info(
        `FETCH ${event}: ${work.length} windows to process (quota left ${quota})`,
      );

      for (const window of work) {
        if (signal.aborted) break;
        try {
          await processWindow(window, run.counters, logger, signal, dryRun);
        } catch (err) {
          if (err instanceof FreshchatError && err.code === "QUOTA_EXHAUSTED") {
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

      if (!dryRun) await advanceCursor(event);
    }

    if (!dryRun && !signal.aborted) {
      logger.info("ENRICH users…");
      await enrichUsers(run.counters, logger);
      logger.info("CLASSIFY…");
      await classifyPending(run.counters, logger);
    }

    run.status = signal.aborted
      ? "aborted"
      : run.counters.windows_failed > 0
        ? "partial"
        : "completed";
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
      `DONE in ${elapsed}s — status=${run.status} created:${run.counters.conversations_inserted} updated:${run.counters.conversations_updated} unchanged:${run.counters.conversations_unchanged} errors:${run.errors.length + run.counters.windows_failed}`,
    );
  }

  return run;
}

export async function shutdownSync(): Promise<void> {
  await closeMongo();
}
