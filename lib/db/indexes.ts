import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  const conversations = db.collection("conversations");
  await conversations.createIndexes([
    { key: { created_at: -1 } },
    { key: { resolved_at: -1 }, sparse: true },
    { key: { status: 1, created_at: -1 } },
    { key: { "derived.subject": 1, created_at: -1 } },
    { key: { "csat.rating": 1, created_at: -1 }, sparse: true },
    { key: { "resolution.label": 1, created_at: -1 }, sparse: true },
    { key: { assigned_agent_id: 1, created_at: -1 }, sparse: true },
    { key: { primary_user_id: 1, created_at: -1 }, sparse: true },
    {
      key: { is_stub: 1 },
      partialFilterExpression: { is_stub: true },
    },
    { key: { updated_at: -1 } },
    { key: { resolved: 1, created_at: -1 } },
  ]);

  const users = db.collection("users");
  await users.createIndexes([
    { key: { role: 1, "enrichment.status": 1 } },
    { key: { email: 1 }, sparse: true },
    { key: { "stats.last_seen_at": -1 } },
  ]);

  const syncWindows = db.collection("sync_windows");
  await syncWindows.createIndexes([
    { key: { event: 1, window_start: 1 } },
    { key: { status: 1, event: 1 } },
    { key: { last_run_id: 1 } },
    { key: { submitted_at: -1 } },
  ]);

  const syncRuns = db.collection("sync_runs");
  await syncRuns.createIndexes([{ key: { started_at: -1 } }]);
}
