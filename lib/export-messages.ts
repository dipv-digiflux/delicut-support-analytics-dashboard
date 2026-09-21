import type { Conversation, EmbeddedMessage } from "@/lib/db/types";

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function collectRawColumnKeys(
  messages: { raw?: Record<string, string> | null }[],
): string[] {
  const keys = new Set<string>();
  for (const m of messages) {
    if (!m.raw) continue;
    for (const k of Object.keys(m.raw)) keys.add(k);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

const MESSAGE_BASE_HEADERS = [
  "conversation_id",
  "channel_id",
  "channel",
  "assigned_agent_id",
  "assigned_agent_name",
  "group_id",
  "group",
  "user_id",
  "resolved",
  "status",
  "conversation_url",
  "messages_truncated",
  "message_id",
  "created_at",
  "actor_type",
  "actor_id",
  "actor_name",
  "actor_email",
  "message_type",
  "detailed_message_type",
  "message_source",
  "text",
  "has_attachment",
  "attachment_count",
  "attachment_names",
  "attachment_urls",
  "attachments_json",
  "raw_json",
] as const;

export function messageExportHeaders(rawKeys: string[]): string[] {
  return [...MESSAGE_BASE_HEADERS, ...rawKeys.map((k) => `raw.${k}`)];
}

export function messageExportRow(
  conv: Pick<
    Conversation,
    | "_id"
    | "channel_id"
    | "channel_name"
    | "assigned_agent_id"
    | "assigned_agent_name"
    | "group_id"
    | "group_name"
    | "primary_user_id"
    | "resolved"
    | "status"
    | "conversation_url"
    | "messages_truncated"
  >,
  m: EmbeddedMessage,
  rawKeys: string[],
): unknown[] {
  const actorName = [m.actor_first_name, m.actor_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const atts = m.attachments || [];
  const raw = m.raw || {};
  return [
    conv._id,
    conv.channel_id,
    conv.channel_name,
    conv.assigned_agent_id,
    conv.assigned_agent_name,
    conv.group_id,
    conv.group_name,
    conv.primary_user_id,
    conv.resolved,
    conv.status,
    conv.conversation_url,
    conv.messages_truncated,
    m.message_id,
    m.created_at?.toISOString?.() || "",
    m.actor_type,
    m.actor_id,
    actorName,
    m.actor_email,
    m.message_type,
    m.detailed_message_type,
    m.message_source,
    m.text,
    m.has_attachment,
    atts.length,
    atts.map((a) => a.file_name || "").join("|"),
    atts.map((a) => a.url || "").join("|"),
    JSON.stringify(atts),
    JSON.stringify(raw),
    ...rawKeys.map((k) => raw[k] ?? ""),
  ];
}

export function mapChatMessage(
  m: EmbeddedMessage,
  extra: {
    conversationId: string;
    channelName: string | null;
    channelId: string | null;
  },
) {
  const actorName = [m.actor_first_name, m.actor_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    messageId: m.message_id,
    conversationId: extra.conversationId,
    createdAt: m.created_at,
    actorType: m.actor_type,
    actorId: m.actor_id,
    actorName: actorName || null,
    actorEmail: m.actor_email || null,
    messageType: m.message_type,
    detailedMessageType: m.detailed_message_type,
    text: m.text,
    hasAttachment: m.has_attachment,
    attachments: m.attachments || [],
    channelName: extra.channelName,
    channelId: extra.channelId,
    messageSource: m.message_source || null,
    /** Full Freshchat CSV row as stored */
    raw: m.raw || null,
  };
}
