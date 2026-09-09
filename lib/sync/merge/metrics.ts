import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { sha256 } from "@/lib/hash/entity-hash";
import { getField } from "@/lib/parse/csv";
import { parseUtcDate } from "@/lib/normalize/dates";
import type { Conversation, ExtractEvent, SyncRunCounters } from "@/lib/db/types";
import type { AnyBulkWriteOperation } from "mongodb";

function parseSeconds(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merge lifecycle / SLA Extract rows onto conversations.
 * Values come straight from Freshchat CSV columns — we do not invent metrics.
 */
export async function mergeMetricRows(
  event: ExtractEvent,
  rows: Record<string, string>[],
  windowId: string,
  counters: SyncRunCounters,
): Promise<void> {
  const cfg = getConfig();
  const { conversations } = await collections();
  const now = new Date();

  type Patch = {
    hashPayload: Record<string, unknown>;
    set: Record<string, unknown>;
    sourceKey: keyof Conversation["sources"];
  };

  const byConv = new Map<string, Patch>();

  for (const row of rows) {
    const conversationId = getField(row, "conversation_id", "interaction_id");
    if (!conversationId) continue;

    if (event === "Conversation-Created") {
      const created_at = parseUtcDate(
        getField(row, "created_at", "created_time"),
      );
      const patch: Patch = {
        sourceKey: "created",
        hashPayload: { conversationId, created_at, row },
        set: {
          created_at,
          channel_id: getField(row, "channel_id"),
          channel_name: getField(row, "channel_name"),
          group_id: getField(row, "group_id"),
          group_name: getField(row, "group_name"),
          assigned_agent_id: getField(row, "agent_id"),
          assigned_agent_name: getField(row, "agent_name"),
          reopened:
            getField(row, "reopened")?.toLowerCase() === "true" ||
            getField(row, "reopened") === "1",
          conversation_url: getField(row, "conversation_url"),
          status: "created",
        },
      };
      byConv.set(conversationId, patch);
    } else if (event === "Conversation-Resolved") {
      const resolved_at = parseUtcDate(
        getField(row, "created_at", "resolved_at"),
      );
      byConv.set(conversationId, {
        sourceKey: "resolved",
        hashPayload: { conversationId, resolved_at, row },
        set: {
          resolved: true,
          resolved_at,
          status: "resolved",
          assigned_agent_id: getField(row, "agent_id"),
          assigned_agent_name: getField(row, "agent_name"),
          group_id: getField(row, "group_id"),
          group_name: getField(row, "group_name"),
          reopened:
            getField(row, "reopened")?.toLowerCase() === "true" ||
            getField(row, "reopened") === "1",
        },
      });
    } else if (event === "First-Response-Time") {
      const seconds = parseSeconds(
        getField(
          row,
          "value_in_seconds",
          "total_first_response_time_in_seconds",
          "value",
        ),
      );
      byConv.set(conversationId, {
        sourceKey: "frt",
        hashPayload: { conversationId, seconds },
        set: { "metrics.first_response_time_seconds": seconds },
      });
    } else if (event === "Resolution-Time") {
      const seconds = parseSeconds(
        getField(row, "value_in_seconds", "resolution_time_in_seconds", "value"),
      );
      byConv.set(conversationId, {
        sourceKey: "resolution_time",
        hashPayload: { conversationId, seconds },
        set: { "metrics.resolution_time_seconds": seconds },
      });
    } else if (event === "Response-Time") {
      const seconds = parseSeconds(
        getField(row, "value_in_seconds", "response_time_in_seconds", "value"),
      );
      byConv.set(conversationId, {
        sourceKey: "response_time",
        hashPayload: { conversationId, seconds },
        set: { "metrics.response_time_seconds": seconds },
      });
    }
  }

  const ids = [...byConv.keys()];
  const existing = await conversations
    .find({ _id: { $in: ids } })
    .project({ sources: 1 })
    .toArray();
  const existingMap = new Map(existing.map((e) => [e._id, e]));

  const ops: AnyBulkWriteOperation<Conversation>[] = [];

  for (const [conversationId, patch] of byConv) {
    const hash = sha256(patch.hashPayload);
    const prev = existingMap.get(conversationId);
    const prevHash = prev?.sources?.[patch.sourceKey]?.hash;
    if (prevHash === hash) {
      counters.conversations_unchanged++;
      continue;
    }

    if (!prev) counters.conversations_inserted++;
    else counters.conversations_updated++;

    ops.push({
      updateOne: {
        filter: { _id: conversationId },
        update: {
          $set: {
            ...patch.set,
            updated_at: now,
            [`sources.${patch.sourceKey}`]: {
              hash,
              window_id: windowId,
              fetched_at: now,
              updated_at: now,
            },
          },
          $setOnInsert: {
            app_id: null,
            channel_id: null,
            channel_name: null,
            status: null,
            assigned_agent_id: null,
            assigned_agent_name: null,
            assigned_group_id: null,
            created_at: null,
            last_message_at: null,
            resolved_at: null,
            resolved: false,
            user_ids: [],
            agent_ids: [],
            primary_user_id: null,
            messages: [],
            message_count: 0,
            messages_truncated: false,
            csat: null,
            resolution: null,
            derived: null,
            metrics: {
              first_response_time_seconds: null,
              resolution_time_seconds: null,
              response_time_seconds: null,
            },
            group_id: null,
            group_name: null,
            reopened: null,
            conversation_url: null,
            is_stub: true,
            stub_reason: "label_orphan",
            first_seen_at: now,
          },
        },
        upsert: true,
      },
    });
  }

  for (let i = 0; i < ops.length; i += cfg.BULK_BATCH_SIZE) {
    const chunk = ops.slice(i, i + cfg.BULK_BATCH_SIZE);
    if (chunk.length) await conversations.bulkWrite(chunk, { ordered: false });
  }
}
