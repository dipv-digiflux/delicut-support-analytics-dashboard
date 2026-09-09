import type { Db } from "mongodb";

/**
 * Ensure indexes for dashboard queries + sync ledger/campaigns.
 * Safe to re-run; Mongo createIndexes is idempotent for matching specs.
 */
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
    { key: { agent_ids: 1, created_at: -1 } },
    { key: { user_ids: 1, created_at: -1 } },
    { key: { channel_id: 1, created_at: -1 }, sparse: true },
    { key: { primary_user_id: 1, created_at: -1 }, sparse: true },
    {
      key: { is_stub: 1 },
      partialFilterExpression: { is_stub: true },
    },
    { key: { updated_at: -1 } },
    { key: { resolved: 1, created_at: -1 } },
    { key: { assigned_agent_name: 1 }, sparse: true },
    { key: { channel_name: 1 }, sparse: true },
    { key: { group_name: 1 }, sparse: true },
    // Chat history / message pagination within a conversation
    { key: { "messages.created_at": -1 } },
    { key: { "messages.message_id": 1 } },
    // Date-range KPIs that filter resolved_at + created_at together
    { key: { resolved: 1, resolved_at: -1 } },
  ]);

  const users = db.collection("users");
  await users.createIndexes([
    { key: { role: 1, "enrichment.status": 1 } },
    { key: { role: 1, first_name: 1, last_name: 1 } },
    { key: { role: 1, "stats.last_seen_at": -1 } },
    { key: { email: 1 }, sparse: true },
    { key: { phone: 1 }, sparse: true },
    { key: { reference_id: 1 }, sparse: true },
    { key: { "stats.last_seen_at": -1 } },
    // Enrichment pending scans during sync
    { key: { "enrichment.status": 1, role: 1 } },
  ]);

  const syncWindows = db.collection("sync_windows");
  // Drop legacy misnamed index (time_start → window_start) if present
  try {
    await syncWindows.dropIndex("event_1_time_start_1");
  } catch {
    // ignore missing / in-use
  }

  await syncWindows.createIndexes([
    // Work selection + campaign range scans
    { key: { event: 1, window_start: 1 } },
    { key: { event: 1, window_start: -1 } },
    // Pending / status filters with date range
    { key: { event: 1, status: 1, window_start: 1 } },
    { key: { status: 1, event: 1 } },
    { key: { is_hot: 1, event: 1 } },
    { key: { last_run_id: 1 } },
    { key: { submitted_at: -1 } },
  ]);

  const syncRuns = db.collection("sync_runs");
  await syncRuns.createIndexes([
    { key: { started_at: -1 } },
    { key: { status: 1, started_at: -1 } },
  ]);

  const syncCampaigns = db.collection("sync_campaigns");
  await syncCampaigns.createIndexes([
    { key: { status: 1, updated_at: -1 } },
    { key: { updated_at: -1 } },
  ]);

  const syncState = db.collection("sync_state");
  await syncState.createIndexes([{ key: { updated_at: -1 } }]);
}
