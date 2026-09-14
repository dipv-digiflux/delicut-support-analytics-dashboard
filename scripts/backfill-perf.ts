/**
 * Performance helpers for conversations:
 * - Ensures denormalized rollups (has_attachment, actor_counts, …)
 * - NEVER deletes Freshchat source fields (message.raw / attachment.raw)
 *
 *   npm run db:optimize
 *
 * To restore message.raw after an accidental strip, replay cached Extract CSVs:
 *   npm run db:restore-raw
 */
import fs from "fs/promises";
import path from "path";
import { collections, closeMongo, getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { getConfig } from "@/lib/config";
import { computeMessageRollup } from "@/lib/conversation-stats";
import { parseCsv } from "@/lib/parse/csv";
import { mergeTranscriptRows } from "@/lib/sync/merge/transcripts";
import type { EmbeddedMessage, SyncRunCounters } from "@/lib/db/types";

const BATCH = 200;

function emptyCounters(): SyncRunCounters {
  return {
    windows_planned: 0,
    windows_submitted: 0,
    windows_merged: 0,
    windows_failed: 0,
    conversations_inserted: 0,
    conversations_updated: 0,
    conversations_unchanged: 0,
    messages_added: 0,
    csat_merged: 0,
    csat_orphans: 0,
    labels_merged: 0,
    users_discovered: 0,
    users_enriched: 0,
    classified: 0,
    reclassified: 0,
    api_calls: 0,
    rate_limit_waits: 0,
  };
}

/** Only adds/updates rollup fields — does not touch messages[] contents. */
async function backfillRollupsOnly() {
  const { conversations } = await collections();
  const total = await conversations.estimatedDocumentCount();
  console.log(
    `[db:optimize] conversations≈${total} — rollups only (keeping all message.raw)`,
  );

  let scanned = 0;
  let updated = 0;
  const cursor = conversations.find(
    {},
    {
      projection: {
        messages: 1,
        has_attachment: 1,
        attachment_count: 1,
        actor_counts: 1,
        preview_text: 1,
      },
      noCursorTimeout: true,
      batchSize: BATCH,
    },
  );

  let batch: {
    updateOne: {
      filter: { _id: string };
      update: { $set: Record<string, unknown> };
    };
  }[] = [];

  for await (const doc of cursor) {
    scanned++;
    const messages = (doc.messages || []) as EmbeddedMessage[];
    const rollup = computeMessageRollup(messages);

    const needsRollup =
      doc.has_attachment !== rollup.has_attachment ||
      doc.attachment_count !== rollup.attachment_count ||
      doc.preview_text !== rollup.preview_text ||
      !doc.actor_counts ||
      doc.actor_counts.user !== rollup.actor_counts.user ||
      doc.actor_counts.agent !== rollup.actor_counts.agent ||
      doc.actor_counts.bot !== rollup.actor_counts.bot ||
      doc.actor_counts.system !== rollup.actor_counts.system;

    if (!needsRollup) continue;

    batch.push({
      updateOne: {
        filter: { _id: doc._id as string },
        update: {
          $set: {
            has_attachment: rollup.has_attachment,
            attachment_count: rollup.attachment_count,
            actor_counts: rollup.actor_counts,
            preview_text: rollup.preview_text,
          },
        },
      },
    });
    updated++;

    if (batch.length >= BATCH) {
      await conversations.bulkWrite(batch, { ordered: false });
      batch = [];
      if (scanned % 2000 === 0) {
        console.log(`[db:optimize] scanned=${scanned} updated=${updated}`);
      }
    }
  }

  if (batch.length) await conversations.bulkWrite(batch, { ordered: false });
  console.log(`[db:optimize] done — scanned=${scanned} updated=${updated}`);
}

/** Replay Chat-Transcript CSVs from EXTRACT_CACHE_DIR to restore message.raw. */
async function restoreRawFromCache() {
  const cfg = getConfig();
  const cacheDir = path.resolve(process.cwd(), cfg.EXTRACT_CACHE_DIR);
  let files: string[] = [];
  try {
    files = (await fs.readdir(cacheDir))
      .filter((f) => f.startsWith("Chat-Transcript_") && f.endsWith(".csv"))
      .sort();
  } catch {
    console.error(`[db:restore-raw] cache dir missing: ${cacheDir}`);
    return;
  }

  console.log(
    `[db:restore-raw] replaying ${files.length} Chat-Transcript cache files from ${cacheDir}`,
  );

  const counters = emptyCounters();
  let fileN = 0;
  for (const file of files) {
    fileN++;
    const full = path.join(cacheDir, file);
    const buf = await fs.readFile(full);
    const rows = parseCsv(buf);
    if (!rows.length) continue;
    await mergeTranscriptRows(rows, `cache-restore|${file}`, counters);
    if (fileN % 25 === 0 || fileN === files.length) {
      console.log(
        `[db:restore-raw] ${fileN}/${files.length} files — updated=${counters.conversations_updated} unchanged=${counters.conversations_unchanged}`,
      );
    }
  }

  console.log(
    `[db:restore-raw] done — updated=${counters.conversations_updated} unchanged=${counters.conversations_unchanged} inserted=${counters.conversations_inserted}`,
  );
}

async function main() {
  const mode = process.argv.includes("--restore-raw")
    ? "restore-raw"
    : "optimize";
  const db = await getDb();
  await ensureIndexes(db);

  if (mode === "restore-raw") {
    await restoreRawFromCache();
    // Refresh rollups after messages rewrite
    await backfillRollupsOnly();
  } else {
    await backfillRollupsOnly();
  }
}

main()
  .then(() => closeMongo())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await closeMongo().catch(() => undefined);
    process.exit(1);
  });
