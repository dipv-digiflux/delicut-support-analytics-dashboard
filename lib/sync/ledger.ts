import { collections } from "@/lib/db/client";
import type { ExtractEvent, SyncWindow } from "@/lib/db/types";
import type { PlannedWindow } from "./planner";
import { needsFetch } from "./planner";

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

export async function selectWorkWindows(
  event: ExtractEvent,
  force = false,
  limit?: number,
): Promise<SyncWindow[]> {
  const { syncWindows } = await collections();
  const all = await syncWindows
    .find({ event })
    .sort({ window_start: 1 })
    .toArray();

  const work = all.filter((w) => needsFetch(w, force));
  return typeof limit === "number" ? work.slice(0, limit) : work;
}

export async function markWindow(
  id: string,
  patch: Partial<SyncWindow>,
): Promise<void> {
  const { syncWindows } = await collections();
  await syncWindows.updateOne({ _id: id }, { $set: patch });
}
