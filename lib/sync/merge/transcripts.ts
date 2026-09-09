import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import {
  transcriptHash,
} from "@/lib/hash/entity-hash";
import { getField } from "@/lib/parse/csv";
import { parseUtcDate } from "@/lib/normalize/dates";
import { textFromMessageParts, normalizeText } from "@/lib/normalize/text";
import { mapActorType } from "@/lib/normalize/ids";
import type {
  Conversation,
  EmbeddedMessage,
  SyncRunCounters,
} from "@/lib/db/types";
import type { AnyBulkWriteOperation } from "mongodb";

export interface DiscoveredActor {
  id: string;
  role: "user" | "agent";
  last_seen_at: Date;
  name?: string | null;
}

export async function mergeTranscriptRows(
  rows: Record<string, string>[],
  windowId: string,
  counters: SyncRunCounters,
): Promise<{ discovered: DiscoveredActor[] }> {
  const cfg = getConfig();
  const { conversations } = await collections();
  const now = new Date();
  const discovered = new Map<string, DiscoveredActor>();

  // Dedupe rows by message_id
  const byMessage = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const mid =
      getField(row, "message_id") ||
      `${getField(row, "conversation_id")}-${getField(row, "created_time")}-${getField(row, "actor_id")}`;
    if (!mid) continue;
    byMessage.set(mid, row);
  }

  const byConv = new Map<string, EmbeddedMessage[]>();
  const meta = new Map<
    string,
    {
      channel_id: string | null;
      channel_name: string | null;
      conversation_url: string | null;
      customer_id: string | null;
      user_ids: Set<string>;
      agent_ids: Set<string>;
      agent_name: string | null;
      created_at: Date | null;
      last_message_at: Date | null;
    }
  >();

  for (const [messageId, row] of byMessage) {
    const conversationId = getField(row, "conversation_id");
    if (!conversationId) continue;

    const createdAt =
      parseUtcDate(getField(row, "created_time", "created_at")) || now;
    const actorType = mapActorType(getField(row, "actor_type"));
    const actorId = getField(row, "actor_id");
    const { text, hasAttachment } = textFromMessageParts(
      getField(row, "message_parts"),
    );

    const msg: EmbeddedMessage = {
      message_id: messageId,
      created_at: createdAt,
      actor_type: actorType,
      actor_id: actorId,
      actor_email: getField(row, "actor_email"),
      actor_first_name: getField(row, "actor_first_name"),
      actor_last_name: getField(row, "actor_last_name"),
      message_type: getField(row, "message_type"),
      detailed_message_type: getField(row, "detailed_message_type"),
      message_source: getField(row, "message_source"),
      text: text || normalizeText(getField(row, "message")),
      has_attachment: hasAttachment,
      raw: { ...row },
    };

    if (!byConv.has(conversationId)) byConv.set(conversationId, []);
    byConv.get(conversationId)!.push(msg);

    if (!meta.has(conversationId)) {
      meta.set(conversationId, {
        channel_id: getField(row, "channel_id"),
        channel_name: getField(row, "channel_name"),
        conversation_url: getField(row, "conversation_url"),
        customer_id: getField(row, "customer_id"),
        user_ids: new Set(),
        agent_ids: new Set(),
        agent_name: null,
        created_at: null,
        last_message_at: null,
      });
    }
    const m = meta.get(conversationId)!;
    if (!m.created_at || createdAt < m.created_at) m.created_at = createdAt;
    if (!m.last_message_at || createdAt > m.last_message_at) {
      m.last_message_at = createdAt;
    }
    m.channel_id = m.channel_id || getField(row, "channel_id");
    m.channel_name = m.channel_name || getField(row, "channel_name");
    m.conversation_url =
      m.conversation_url || getField(row, "conversation_url");

    const customerId = getField(row, "customer_id");
    if (customerId) {
      m.customer_id = m.customer_id || customerId;
      m.user_ids.add(customerId);
    }

    if (actorId) {
      if (actorType === "user") {
        m.user_ids.add(actorId);
        discovered.set(actorId, {
          id: actorId,
          role: "user",
          last_seen_at: createdAt,
        });
      } else if (actorType === "agent") {
        m.agent_ids.add(actorId);
        const name = [
          getField(row, "actor_first_name"),
          getField(row, "actor_last_name"),
        ]
          .filter(Boolean)
          .join(" ");
        m.agent_name = name || m.agent_name;
        discovered.set(actorId, {
          id: actorId,
          role: "agent",
          last_seen_at: createdAt,
          name: name || null,
        });
      }
    }
  }

  const ids = [...byConv.keys()];
  const existing = await conversations
    .find({ _id: { $in: ids } })
    .project({
      messages: 1,
      sources: 1,
      is_stub: 1,
      user_ids: 1,
      agent_ids: 1,
      csat: 1,
      resolution: 1,
      derived: 1,
      assigned_agent_id: 1,
      assigned_agent_name: 1,
      primary_user_id: 1,
    })
    .toArray();
  const existingMap = new Map(existing.map((e) => [e._id, e]));

  const ops: AnyBulkWriteOperation<Conversation>[] = [];

  for (const [conversationId, incoming] of byConv) {
    const m = meta.get(conversationId)!;
    const prev = existingMap.get(conversationId);
    const msgMap = new Map<string, EmbeddedMessage>();
    for (const msg of prev?.messages || []) msgMap.set(msg.message_id, msg);
    for (const msg of incoming) msgMap.set(msg.message_id, msg);

    let messages = [...msgMap.values()].sort((a, b) => {
      const t = a.created_at.getTime() - b.created_at.getTime();
      return t !== 0 ? t : a.message_id.localeCompare(b.message_id);
    });

    let truncated = false;
    if (messages.length > cfg.MAX_EMBEDDED_MESSAGES) {
      truncated = true;
      const keep = Math.floor(cfg.MAX_EMBEDDED_MESSAGES / 2);
      messages = [
        ...messages.slice(0, keep),
        ...messages.slice(messages.length - keep),
      ];
    }

    const userIds = [
      ...new Set([...(prev?.user_ids || []), ...m.user_ids]),
    ].sort();
    const agentIds = [
      ...new Set([...(prev?.agent_ids || []), ...m.agent_ids]),
    ].sort();
    // Prefer Freshchat customer_id; never invent assignee from first sorted agent id
    const primaryUserId =
      m.customer_id ||
      (prev as { primary_user_id?: string | null } | undefined)
        ?.primary_user_id ||
      userIds[0] ||
      null;
    const assignedAgentId = prev?.assigned_agent_id || null;
    const assignedAgentName =
      prev?.assigned_agent_name ||
      (assignedAgentId ? m.agent_name : null) ||
      null;

    const hash = transcriptHash({
      conversation_id: conversationId,
      app_id: null,
      channel_id: m.channel_id,
      status: null,
      assigned_agent_id: assignedAgentId,
      assigned_group_id: null,
      created_at: m.created_at,
      resolved_at: null,
      last_message_at: m.last_message_at,
      messages,
    });

    if (prev?.sources?.transcript?.hash === hash) {
      counters.conversations_unchanged++;
      continue;
    }

    const isNew = !prev;
    if (isNew) counters.conversations_inserted++;
    else counters.conversations_updated++;

    const prevCount = prev?.messages?.length || 0;
    counters.messages_added += Math.max(0, messages.length - prevCount);

    ops.push({
      updateOne: {
        filter: { _id: conversationId },
        update: {
          $set: {
            channel_id: m.channel_id,
            channel_name: m.channel_name,
            conversation_url: m.conversation_url,
            assigned_agent_id: assignedAgentId,
            assigned_agent_name: assignedAgentName,
            created_at: m.created_at,
            last_message_at: m.last_message_at,
            user_ids: userIds,
            agent_ids: agentIds,
            primary_user_id: primaryUserId,
            messages,
            message_count: messages.length,
            messages_truncated: truncated,
            is_stub: false,
            stub_reason: null,
            updated_at: now,
            "sources.transcript": {
              hash,
              window_id: windowId,
              fetched_at: now,
              updated_at: now,
            },
          },
          $setOnInsert: {
            app_id: null,
            status: null,
            assigned_group_id: null,
            resolved_at: null,
            resolved: false,
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

  return { discovered: [...discovered.values()] };
}
