export type SubjectSource =
  | "resolution_label"
  | "keyword"
  | "llm"
  | "none";

export type ActorType = "user" | "agent" | "bot" | "system";

export type ExtractEvent =
  | "Chat-Transcript"
  | "CSAT-Score"
  | "Conversation-Resolution-Label"
  | "Conversation-Created"
  | "Conversation-Resolved"
  | "First-Response-Time"
  | "Resolution-Time"
  | "Response-Time"
  | "Message-Sent";

export type WindowStatus =
  | "planned"
  | "submitted"
  | "ready"
  | "merged"
  | "failed"
  | "skipped";

export type EnrichmentStatus = "pending" | "ok" | "not_found" | "error";

export interface EmbeddedMessage {
  message_id: string;
  created_at: Date;
  actor_type: ActorType;
  actor_id: string | null;
  actor_email: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
  message_type: string | null;
  detailed_message_type: string | null;
  message_source: string | null;
  text: string;
  has_attachment: boolean;
  /** Original CSV columns for this message — Freshchat as-is */
  raw: Record<string, string>;
}

export interface SourceState {
  hash: string;
  window_id: string;
  fetched_at: Date;
  updated_at: Date;
}

export interface Conversation {
  _id: string;
  app_id: string | null;
  channel_id: string | null;
  channel_name: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  assigned_group_id: string | null;
  created_at: Date | null;
  last_message_at: Date | null;
  resolved_at: Date | null;
  resolved: boolean;
  user_ids: string[];
  agent_ids: string[];
  primary_user_id: string | null;
  messages: EmbeddedMessage[];
  message_count: number;
  messages_truncated: boolean;
  csat: {
    rating: number | null;
    rating_raw: string | null;
    comment: string | null;
    submitted_at: Date | null;
    survey_id: string | null;
  } | null;
  resolution: {
    label: string | null;
    sub_label: string | null;
    labeled_at: Date | null;
    labeled_by_agent_id: string | null;
  } | null;
  /** Freshchat SLA / lifecycle metrics as reported (seconds) — not inventing values */
  metrics: {
    first_response_time_seconds: number | null;
    resolution_time_seconds: number | null;
    response_time_seconds: number | null;
  };
  group_id: string | null;
  group_name: string | null;
  reopened: boolean | null;
  conversation_url: string | null;
  derived: {
    subject: string;
    subject_source: SubjectSource;
    confidence: number;
    matched_keywords: string[];
    classifier_version: string;
    classified_at: Date;
  } | null;
  sources: {
    transcript?: SourceState;
    csat?: SourceState;
    label?: SourceState;
    created?: SourceState;
    resolved?: SourceState;
    frt?: SourceState;
    resolution_time?: SourceState;
    response_time?: SourceState;
  };
  is_stub: boolean;
  stub_reason: "csat_orphan" | "label_orphan" | null;
  first_seen_at: Date;
  updated_at: Date;
}

export interface User {
  _id: string;
  role: "user" | "agent";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  reference_id: string | null;
  properties: Record<string, string | number | boolean | null>;
  enrichment: {
    status: EnrichmentStatus;
    hash: string | null;
    fetched_at: Date | null;
    attempts: number;
    last_error: string | null;
  };
  stats: {
    first_seen_at: Date;
    last_seen_at: Date;
    conversation_count: number;
  };
  updated_at: Date;
}

export interface SyncWindow {
  _id: string;
  event: ExtractEvent;
  window_start: Date;
  window_end: Date;
  is_hot: boolean;
  status: WindowStatus;
  freshchat_job_id: string | null;
  download_links: string[];
  links_issued_at: Date | null;
  attempts: number;
  submitted_at: Date | null;
  ready_at: Date | null;
  merged_at: Date | null;
  row_count: number;
  rows_inserted: number;
  rows_updated: number;
  rows_unchanged: number;
  content_checksum: string | null;
  last_run_id: string;
  last_error: { code: string; message: string; at: Date } | null;
}

export interface SyncCursor {
  _id: ExtractEvent;
  last_successful_end: Date | null;
  overlap: { value: number; unit: "hours" | "days" };
  updated_at: Date;
}

export interface ExtractBudget {
  _id: "extract_api";
  last_post_at: Date | null;
  quota_day: string;
  posts_today: Partial<Record<ExtractEvent, number>>;
  updated_at: Date;
}

export interface SyncRunCounters {
  windows_planned: number;
  windows_submitted: number;
  windows_merged: number;
  windows_failed: number;
  conversations_inserted: number;
  conversations_updated: number;
  conversations_unchanged: number;
  messages_added: number;
  csat_merged: number;
  csat_orphans: number;
  labels_merged: number;
  users_discovered: number;
  users_enriched: number;
  classified: number;
  reclassified: number;
  api_calls: number;
  rate_limit_waits: number;
}

export interface SyncRun {
  _id: string;
  mode: "backfill" | "incremental" | "repair";
  started_at: Date;
  finished_at: Date | null;
  status: "running" | "completed" | "partial" | "failed" | "aborted";
  params: {
    lookback_days: number;
    events: ExtractEvent[];
    dry_run: boolean;
    since: Date | null;
    until: Date | null;
  };
  counters: SyncRunCounters;
  errors: { code: string; message: string; context: string; at: Date }[];
  host: string;
  git_sha: string | null;
}

export function emptyCounters(): SyncRunCounters {
  return {
    windows_planned: 0,
    windows_submitted: 0,
    windows_merged: 0,
    windows_failed: 0,
    conversations_inserted: 0,
    conversations_updated: 0,
    conversations_unchanged: 0,
    messages_added: 0,
    csat_merged: 0,
    csat_orphans: 0,
    labels_merged: 0,
    users_discovered: 0,
    users_enriched: 0,
    classified: 0,
    reclassified: 0,
    api_calls: 0,
    rate_limit_waits: 0,
  };
}
