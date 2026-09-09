import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { labelHash } from "@/lib/hash/entity-hash";
import { getField } from "@/lib/parse/csv";
import { parseUtcDate } from "@/lib/normalize/dates";
import type { Conversation, SyncRunCounters } from "@/lib/db/types";
import type { AnyBulkWriteOperation } from "mongodb";

export async function mergeLabelRows(
  rows: Record<string, string>[],
  windowId: string,
  counters: SyncRunCounters,
): Promise<void> {
  const cfg = getConfig();
  const { conversations } = await collections();
  const now = new Date();

  const byConv = new Map<
    string,
    {
      label: string | null;
      sub_label: string | null;
      labeled_at: Date | null;
      labeled_by_agent_id: string | null;
      agent_name: string | null;
    }
  >();

  for (const row of rows) {
    const conversationId = getField(row, "conversation_id");
    if (!conversationId) continue;

    const labeled_at = parseUtcDate(getField(row, "created_at"));
    const label =
      getField(row, "label_category_name", "resolution_label", "label") || null;
    const sub_label =
      getField(
        row,
        "label_sub_category_name",
        "abel_sub_category_name",
        "sub_label",
      ) || null;

    const prev = byConv.get(conversationId);
    if (
      !prev ||
      (labeled_at && (!prev.labeled_at || labeled_at > prev.labeled_at))
    ) {
      byConv.set(conversationId, {
        label,
        sub_label,
        labeled_at,
        labeled_by_agent_id: getField(row, "agent_id", "actor_id"),
        agent_name: getField(row, "agent_name", "actor_name"),
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

  for (const [conversationId, resolution] of byConv) {
    const hash = labelHash({
      conversation_id: conversationId,
      label: resolution.label,
      sub_label: resolution.sub_label,
      labeled_at: resolution.labeled_at,
      labeled_by_agent_id: resolution.labeled_by_agent_id,
    });

    const prev = existingMap.get(conversationId);
    if (prev?.sources?.label?.hash === hash) {
      counters.conversations_unchanged++;
      continue;
    }

    counters.labels_merged++;
    if (!prev) counters.conversations_inserted++;
    else counters.conversations_updated++;

    ops.push({
      updateOne: {
        filter: { _id: conversationId },
        update: {
          $set: {
            resolution: {
              label: resolution.label,
              sub_label: resolution.sub_label,
              labeled_at: resolution.labeled_at,
              labeled_by_agent_id: resolution.labeled_by_agent_id,
            },
            // Do NOT invent resolved/status from label alone —
            // Conversation-Resolved report owns that (as-is Freshchat data).
            updated_at: now,
            ...(resolution.labeled_by_agent_id
              ? {
                  assigned_agent_id: resolution.labeled_by_agent_id,
                  assigned_agent_name: resolution.agent_name,
                }
              : {}),
            "sources.label": {
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
            assigned_group_id: null,
            created_at: null,
            last_message_at: null,
            resolved_at: null,
            resolved: false,
            status: null,
            user_ids: [],
            agent_ids: resolution.labeled_by_agent_id
              ? [resolution.labeled_by_agent_id]
              : [],
            primary_user_id: null,
            messages: [],
            message_count: 0,
            messages_truncated: false,
            csat: null,
            derived: null,
            is_stub: true,
            stub_reason: "label_orphan",
            first_seen_at: now,
            assigned_agent_id: resolution.labeled_by_agent_id,
            assigned_agent_name: resolution.agent_name,
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
