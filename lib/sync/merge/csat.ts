import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { csatHash } from "@/lib/hash/entity-hash";
import { getField } from "@/lib/parse/csv";
import { parseUtcDate } from "@/lib/normalize/dates";
import { normalizeCsatRating } from "@/lib/normalize/csat";
import { normalizeText } from "@/lib/normalize/text";
import type { Conversation, SyncRunCounters } from "@/lib/db/types";
import type { AnyBulkWriteOperation } from "mongodb";

export async function mergeCsatRows(
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
      rating: number | null;
      rating_raw: string | null;
      comment: string | null;
      submitted_at: Date | null;
      survey_id: string | null;
      agent_id: string | null;
      agent_name: string | null;
    }
  >();

  for (const row of rows) {
    const conversationId = getField(row, "conversation_id");
    if (!conversationId) continue;

    let rating: number | null = null;
    let rating_raw: string | null = null;
    try {
      const normalized = normalizeCsatRating(
        getField(row, "value", "csat_score", "rating"),
      );
      rating = normalized.rating;
      rating_raw = normalized.rating_raw;
    } catch {
      // Skip unmapped row — don't fail the whole window (as-is: keep raw if we can)
      rating_raw = getField(row, "value", "csat_score", "rating");
      rating = null;
    }
    const submitted_at = parseUtcDate(
      getField(row, "created_at", "csat_rated_at"),
    );
    const survey_id = getField(row, "csat_id", "survey_id");
    const comment = normalizeText(
      getField(row, "csat_response", "comment", "feedback"),
    );

    const prev = byConv.get(conversationId);
    // Keep latest rating by submitted_at
    if (
      !prev ||
      (submitted_at &&
        (!prev.submitted_at || submitted_at > prev.submitted_at))
    ) {
      byConv.set(conversationId, {
        rating,
        rating_raw,
        comment: comment || null,
        submitted_at,
        survey_id,
        agent_id: getField(row, "agent_id", "actor_id"),
        agent_name: getField(row, "agent_name", "actor_name"),
      });
    }
  }

  const ids = [...byConv.keys()];
  const existing = await conversations
    .find({ _id: { $in: ids } })
    .project({ sources: 1, assigned_agent_id: 1, assigned_agent_name: 1 })
    .toArray();
  const existingMap = new Map(existing.map((e) => [e._id, e]));

  const ops: AnyBulkWriteOperation<Conversation>[] = [];

  for (const [conversationId, csat] of byConv) {
    const hash = csatHash({
      conversation_id: conversationId,
      rating: csat.rating,
      rating_raw: csat.rating_raw,
      comment: csat.comment,
      submitted_at: csat.submitted_at,
      survey_id: csat.survey_id,
    });

    const prev = existingMap.get(conversationId);
    if (prev?.sources?.csat?.hash === hash) {
      counters.conversations_unchanged++;
      continue;
    }

    if (!prev) counters.csat_orphans++;
    counters.csat_merged++;
    if (!prev) counters.conversations_inserted++;
    else counters.conversations_updated++;

    ops.push({
      updateOne: {
        filter: { _id: conversationId },
        update: {
          $set: {
            csat: {
              rating: csat.rating,
              rating_raw: csat.rating_raw,
              comment: csat.comment,
              submitted_at: csat.submitted_at,
              survey_id: csat.survey_id,
            },
            updated_at: now,
            "sources.csat": {
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
            assigned_group_id: null,
            created_at: null,
            last_message_at: null,
            resolved_at: null,
            resolved: false,
            user_ids: [],
            agent_ids: csat.agent_id ? [csat.agent_id] : [],
            primary_user_id: null,
            messages: [],
            message_count: 0,
            messages_truncated: false,
            resolution: null,
            derived: null,
            is_stub: true,
            stub_reason: "csat_orphan",
            first_seen_at: now,
            assigned_agent_id: csat.agent_id,
            assigned_agent_name: csat.agent_name,
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
