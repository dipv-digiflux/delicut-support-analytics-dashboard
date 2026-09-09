import { collections } from "@/lib/db/client";
import type { ExtractEvent, SyncCursor } from "@/lib/db/types";
import { overlapFor } from "./planner";

export async function getCursor(
  event: ExtractEvent,
): Promise<SyncCursor | null> {
  const { syncState } = await collections();
  const doc = await syncState.findOne({ _id: event });
  if (doc && "last_successful_end" in doc) return doc as SyncCursor;
  return null;
}

export async function ensureCursor(event: ExtractEvent): Promise<SyncCursor> {
  const existing = await getCursor(event);
  if (existing) return existing;
  const { syncState } = await collections();
  const created: SyncCursor = {
    _id: event,
    last_successful_end: null,
    overlap: overlapFor(event),
    updated_at: new Date(),
  };
  await syncState.updateOne(
    { _id: event },
    { $setOnInsert: created },
    { upsert: true },
  );
  return (await getCursor(event))!;
}

/** Advance watermark only through contiguous merged/skipped prefix. */
export async function advanceCursor(event: ExtractEvent): Promise<Date | null> {
  const { syncWindows, syncState } = await collections();
  const windows = await syncWindows
    .find({ event }, { projection: { window_end: 1, status: 1, window_start: 1 } })
    .sort({ window_start: 1 })
    .toArray();

  let watermark: Date | null = null;
  for (const w of windows) {
    if (w.status === "merged" || w.status === "skipped") {
      watermark = w.window_end;
    } else {
      break;
    }
  }

  if (watermark) {
    await syncState.updateOne(
      { _id: event },
      {
        $set: {
          last_successful_end: watermark,
          overlap: overlapFor(event),
          updated_at: new Date(),
        },
      },
      { upsert: true },
    );
  }
  return watermark;
}
