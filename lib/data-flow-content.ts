import type { ExtractEvent } from "@/lib/db/types";

export const DATA_FLOW_PIPES = [
  {
    id: "extract",
    name: "A. Extract API",
    direction: "We pull",
    when: "When sync runs",
    used: true,
    usedLabel: "Primary warehouse",
    detail:
      "POST /v2/reports/raw → poll job → download CSV. History, CSAT, labels, SLA seconds, transcripts.",
  },
  {
    id: "webhooks",
    name: "B. Chat webhooks",
    direction: "Freshchat pushes",
    when: "On message / assign / resolve / reopen",
    used: false,
    usedLabel: "Not wired",
    detail:
      "Would be live, but does not send CSAT, labels, or SLA seconds. We have no webhook URL in this app.",
  },
  {
    id: "rest",
    name: "C. REST APIs",
    direction: "We pull",
    when: "On demand after sync discovers user ids",
    used: true,
    usedLabel: "Users enrich only",
    detail:
      "POST /v2/users/fetch for name, email, phone, properties. Chat REST is not used for KPIs.",
  },
] as const;

export const EXTRACT_EVENTS: {
  event: ExtractEvent;
  defaultOn: boolean;
  gives: string;
  landsIn: string;
  usedOn: string;
}[] = [
  {
    event: "Chat-Transcript",
    defaultOn: true,
    gives: "Messages, actors, channel, customer/agent ids, attachments",
    landsIn: "conversations.messages (+ raw CSV columns)",
    usedOn: "Chat, message counts, actor share, attachments, user discovery",
  },
  {
    event: "CSAT-Score",
    defaultOn: true,
    gives: "Rating, comment, submit time, agent",
    landsIn: "conversations.csat",
    usedOn: "Avg CSAT, distribution, satisfied %, agent CSAT",
  },
  {
    event: "Conversation-Resolution-Label",
    defaultOn: true,
    gives: "Category / subcategory at resolve",
    landsIn: "conversations.resolution + derived.subject",
    usedOn: "Label coverage, by-label charts, filters",
  },
  {
    event: "Conversation-Created",
    defaultOn: true,
    gives: "Create time, channel, group, agent, reopen flags",
    landsIn: "conversations created_at + dims",
    usedOn: "Volume, heatmap, channel/group breakdowns",
  },
  {
    event: "Conversation-Resolved",
    defaultOn: true,
    gives: "Resolve time, status",
    landsIn: "conversations.resolved / resolved_at",
    usedOn: "Resolution rate, resolved trend, open count",
  },
  {
    event: "First-Response-Time",
    defaultOn: true,
    gives: "Seconds to first response",
    landsIn: "metrics.first_response_time_seconds",
    usedOn: "Avg / median FRT, FRT buckets",
  },
  {
    event: "Resolution-Time",
    defaultOn: true,
    gives: "Seconds to resolve",
    landsIn: "metrics.resolution_time_seconds",
    usedOn: "Avg / median resolution, resolution buckets",
  },
  {
    event: "Response-Time",
    defaultOn: false,
    gives: "Per-response latency seconds",
    landsIn: "metrics.response_time_seconds",
    usedOn: "Typed in code; off unless added to SYNC_EVENTS",
  },
  {
    event: "Message-Sent",
    defaultOn: false,
    gives: "Per-message send events",
    landsIn: "Not merged by default",
    usedOn: "Off unless added to SYNC_EVENTS",
  },
];

export const UI_SURFACES = [
  {
    name: "Dashboard",
    path: "/dashboard",
    reads: "Aggregations on conversations (slim fields, no messages[])",
  },
  {
    name: "Conversations table",
    path: "/conversations",
    reads: "One row per chat; preview + counts. Raw button loads full Mongo doc including messages.",
  },
  {
    name: "Chat",
    path: "/conversations/[id]",
    reads: "Paginated messages[] with full raw CSV + attachments. Infinite scroll loads every stored message.",
  },
  {
    name: "Customers",
    path: "/users",
    reads: "users collection + conversation counts",
  },
  {
    name: "Export conversations",
    path: "/api/conversations/export",
    reads: "One CSV row per conversation (all metadata, no message bodies)",
  },
  {
    name: "Excel dump (CLI)",
    path: "npm run export:xlsx",
    reads: "Workbook tabs: Info, Conversations, Messages, CSAT, Labels, Users, and All (one row per message with every field + raw CSV columns)",
  },
];

export const NOT_GETTING = [
  "True live / second-level updates (UI is as fresh as last sync)",
  "Webhook push (not registered)",
  "Windows we never synced",
  "Agent-Activity / Team-Performance / Instant Metrics (not in default SYNC_EVENTS)",
  "CSAT, labels, or SLA seconds from webhooks alone — Extract stays required",
];
