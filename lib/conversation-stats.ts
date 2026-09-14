import type { ActorType, EmbeddedMessage } from "@/lib/db/types";

export type ActorCounts = Record<ActorType, number>;

const EMPTY_ACTOR_COUNTS: ActorCounts = {
  user: 0,
  agent: 0,
  bot: 0,
  system: 0,
};

const PREVIEW_MAX = 240;

/** Denormalized rollups so KPI/list queries never scan embedded messages. */
export function computeMessageRollup(messages: EmbeddedMessage[]): {
  has_attachment: boolean;
  attachment_count: number;
  actor_counts: ActorCounts;
  preview_text: string;
} {
  const actor_counts: ActorCounts = { ...EMPTY_ACTOR_COUNTS };
  let attachment_count = 0;
  let preview_text = "";

  for (const m of messages) {
    const t = m.actor_type in actor_counts ? m.actor_type : "system";
    actor_counts[t] += 1;

    const n =
      m.attachments?.length ||
      (m.has_attachment ? 1 : 0);
    attachment_count += n;

    if (!preview_text && m.actor_type === "user" && m.text?.trim()) {
      const t = m.text.trim();
      preview_text =
        t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX)}…` : t;
    }
  }

  return {
    has_attachment: attachment_count > 0,
    attachment_count,
    actor_counts,
    preview_text,
  };
}

/** Fields needed by dashboard KPI aggregations — excludes heavy `messages[]`. */
export const KPI_PROJECT = {
  primary_user_id: 1,
  resolved: 1,
  reopened: 1,
  csat: 1,
  resolution: 1,
  derived: 1,
  message_count: 1,
  metrics: 1,
  channel_name: 1,
  assigned_agent_id: 1,
  assigned_agent_name: 1,
  group_id: 1,
  group_name: 1,
  created_at: 1,
  resolved_at: 1,
  has_attachment: 1,
  attachment_count: 1,
  actor_counts: 1,
  preview_text: 1,
} as const;

/** List/table projection — no full message bodies. */
export const LIST_PROJECT = {
  ...KPI_PROJECT,
  status: 1,
  channel_id: 1,
  last_message_at: 1,
  conversation_url: 1,
  is_stub: 1,
  agent_ids: 1,
  updated_at: 1,
} as const;
