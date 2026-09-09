import { createHash } from "crypto";
import { canonicalJson } from "./canonical";
import type { EmbeddedMessage } from "@/lib/db/types";

export function sha256(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function transcriptHash(input: {
  conversation_id: string;
  app_id: string | null;
  channel_id: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  assigned_group_id: string | null;
  created_at: Date | null;
  resolved_at: Date | null;
  last_message_at: Date | null;
  messages: EmbeddedMessage[];
}): string {
  return sha256({
    conversation_id: input.conversation_id,
    app_id: input.app_id,
    channel_id: input.channel_id,
    status: input.status,
    assigned_agent_id: input.assigned_agent_id,
    assigned_group_id: input.assigned_group_id,
    created_at: input.created_at,
    resolved_at: input.resolved_at,
    last_message_at: input.last_message_at,
    messages: input.messages.map((m) => [
      m.message_id,
      m.created_at,
      m.actor_type,
      m.actor_id,
      m.message_type,
      m.text,
      m.has_attachment,
      (m.attachments || []).map((a) => [
        a.kind,
        a.url,
        a.file_name,
        a.mime_type,
        a.size_bytes,
      ]),
    ]),
  });
}

export function csatHash(input: {
  conversation_id: string;
  rating: number | null;
  rating_raw: string | null;
  comment: string | null;
  submitted_at: Date | null;
  survey_id: string | null;
}): string {
  return sha256(input);
}

export function labelHash(input: {
  conversation_id: string;
  label: string | null;
  sub_label: string | null;
  labeled_at: Date | null;
  labeled_by_agent_id: string | null;
}): string {
  return sha256(input);
}

export function userHash(input: {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  reference_id: string | null;
  properties: Record<string, string | number | boolean | null>;
}): string {
  return sha256({
    ...input,
    properties: Object.fromEntries(
      Object.entries(input.properties).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
}

export function contentChecksum(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}
