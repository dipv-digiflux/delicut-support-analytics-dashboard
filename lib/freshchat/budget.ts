import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import type { ExtractEvent, ExtractBudget } from "@/lib/db/types";

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOrInitBudget(): Promise<ExtractBudget> {
  const { syncState } = await collections();
  const day = utcDayKey();
  const existing = await syncState.findOne({ _id: "extract_api" as const });
  if (existing && "quota_day" in existing) {
    if (existing.quota_day !== day) {
      const reset: ExtractBudget = {
        _id: "extract_api",
        last_post_at: existing.last_post_at,
        quota_day: day,
        posts_today: {},
        updated_at: new Date(),
      };
      await syncState.replaceOne({ _id: "extract_api" }, reset);
      return reset;
    }
    return existing as ExtractBudget;
  }

  const created: ExtractBudget = {
    _id: "extract_api",
    last_post_at: null,
    quota_day: day,
    posts_today: {},
    updated_at: new Date(),
  };
  await syncState.insertOne(created);
  return created;
}

export async function remainingQuota(event: ExtractEvent): Promise<number> {
  const cfg = getConfig();
  const budget = await getOrInitBudget();
  const used = budget.posts_today[event] ?? 0;
  return Math.max(0, cfg.EXTRACT_MAX_JOBS_PER_DAY - used);
}

/** Wait for 1/min + daily quota; returns false if daily quota exhausted. */
export async function acquireExtractSlot(
  event: ExtractEvent,
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getConfig();
  const { syncState } = await collections();

  for (;;) {
    await getOrInitBudget();
    const budget = (await syncState.findOne({
      _id: "extract_api",
    })) as ExtractBudget | null;
    if (!budget) continue;

    const used = budget.posts_today[event] ?? 0;
    if (used >= cfg.EXTRACT_MAX_JOBS_PER_DAY) {
      return {
        ok: false,
        reason: `Daily Extract quota exhausted for ${event} (${used}/${cfg.EXTRACT_MAX_JOBS_PER_DAY})`,
      };
    }

    const minInterval = cfg.EXTRACT_MIN_POST_INTERVAL_MS;
    const cutoff = new Date(Date.now() - minInterval);
    const res = await syncState.findOneAndUpdate(
      {
        _id: "extract_api",
        $or: [
          { last_post_at: null },
          { last_post_at: { $lte: cutoff } },
        ],
      },
      {
        $set: { last_post_at: new Date(), updated_at: new Date() },
        $inc: { [`posts_today.${event}`]: 1 },
      },
      { returnDocument: "after" },
    );

    if (res) return { ok: true };

    const wait = Math.min(
      minInterval,
      Math.max(
        500,
        minInterval -
          (Date.now() - (budget.last_post_at?.getTime() ?? 0)),
      ),
    );
    await sleep(wait);
  }
}
