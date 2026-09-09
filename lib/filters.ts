import {
  DEFAULT_TIMEZONE,
  resolveTimeZone,
  zonedDayRangeUtc,
} from "@/lib/timezone";

export interface ConversationFilters {
  from?: string;
  to?: string;
  /** IANA timezone for interpreting from/to calendar days (Dubai / IST / UTC) */
  timeZone: string;
  subject?: string;
  /** @deprecated prefer agentIds — single agent or "unassigned" */
  agent?: string;
  agentIds: string[];
  userIds: string[];
  channelIds: string[];
  channel?: string;
  group?: string;
  resolved?: "true" | "false";
  reopened?: "true" | "false";
  csat?: string;
  q?: string;
  /** When true (default for KPIs), exclude stub orphans with no created_at */
  excludeStubs?: boolean;
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
}

const SORT_ALLOW = new Set([
  "created_at",
  "updated_at",
  "resolved_at",
  "last_message_at",
  "csat",
  "subject",
  "agent",
  "channel",
  "group",
  "resolved",
  "reopened",
  "message_count",
  "frt",
  "resolution_time",
  // customers
  "name",
  "email",
  "phone",
  "last_seen_at",
  "first_seen_at",
  "conversation_count",
  "customer_messages",
]);

export const CONVERSATION_SORT_KEYS = new Set([
  "created_at",
  "updated_at",
  "resolved_at",
  "last_message_at",
  "csat",
  "subject",
  "agent",
  "channel",
  "group",
  "resolved",
  "reopened",
  "message_count",
  "frt",
  "resolution_time",
]);

export const CUSTOMER_SORT_KEYS = new Set([
  "name",
  "email",
  "phone",
  "last_seen_at",
  "first_seen_at",
  "conversation_count",
  "customer_messages",
]);

function getAll(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string[] {
  if (sp instanceof URLSearchParams) {
    const multi = sp.getAll(key).flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);
    if (multi.length) return [...new Set(multi)];
    const single = sp.get(key);
    if (!single) return [];
    return [...new Set(single.split(",").map((s) => s.trim()).filter(Boolean))];
  }
  const v = sp[key];
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return [...new Set(arr.flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean))];
}

export function parseFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): ConversationFilters {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(key) || undefined;
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const sortRaw = get("sort") || "created_at";
  const sort = SORT_ALLOW.has(sortRaw) ? sortRaw : "created_at";
  const order = get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(get("page") || 1) || 1);
  const limitRaw = Number(get("limit") || 25) || 25;
  const limit = [10, 20, 25, 40, 50, 100].includes(limitRaw) ? limitRaw : 25;

  const agentIds = getAll(sp, "agent");
  const legacyAgent = get("agent");
  // If single legacy value and not comma-list style already in agentIds
  const agent =
    agentIds.length === 1 && !getAll(sp, "agentIds").length
      ? agentIds[0]
      : legacyAgent && !legacyAgent.includes(",")
        ? legacyAgent
        : undefined;

  return {
    from: get("from"),
    to: get("to"),
    timeZone: resolveTimeZone(get("tz"), DEFAULT_TIMEZONE),
    subject: get("subject"),
    agent: agentIds.length <= 1 ? agentIds[0] || agent : undefined,
    agentIds: agentIds.filter((id) => id !== "unassigned" || agentIds.length === 1),
    userIds: getAll(sp, "user"),
    channelIds: getAll(sp, "channelId"),
    channel: get("channel"),
    group: get("group"),
    resolved: get("resolved") as "true" | "false" | undefined,
    reopened: get("reopened") as "true" | "false" | undefined,
    csat: get("csat"),
    q: get("q"),
    page,
    limit,
    sort,
    order,
  };
}

/** Inclusive calendar dates of `from`/`to` interpreted in `filters.timeZone`.
 *  Pass `searchUserIds` from `resolveSearchUserIds(filters.q)` so name/phone/email search hits chats.
 */
export function buildConversationMatch(
  filters: ConversationFilters,
  searchUserIds?: string[],
): Record<string, unknown> {
  const and: object[] = [];

  if (filters.from || filters.to) {
    const range = zonedDayRangeUtc(
      filters.from,
      filters.to,
      filters.timeZone || DEFAULT_TIMEZONE,
    );
    and.push({ created_at: range });
  }

  if (filters.excludeStubs !== false) {
    and.push({
      $or: [{ is_stub: { $ne: true } }, { created_at: { $ne: null } }],
    });
  }

  if (filters.subject === "unclassified" || filters.subject === "unlabeled") {
    and.push({
      $or: [
        { "derived.subject": "" },
        { "derived.subject": "unclassified" },
        { derived: null },
        { "derived.subject": { $exists: false } },
        { "resolution.label": null },
        { "resolution.label": "" },
      ],
    });
  } else if (filters.subject) {
    and.push({
      $or: [
        { "derived.subject": filters.subject },
        { "resolution.label": filters.subject },
      ],
    });
  }

  const agentIds = filters.agentIds?.length
    ? filters.agentIds
    : filters.agent
      ? [filters.agent]
      : [];

  if (agentIds.length === 1 && agentIds[0] === "unassigned") {
    and.push({
      $or: [
        { assigned_agent_id: null },
        { assigned_agent_id: { $exists: false } },
        { assigned_agent_id: "" },
        { agent_ids: { $size: 0 } },
      ],
    });
  } else if (agentIds.length) {
    const ids = agentIds.filter((id) => id !== "unassigned");
    if (ids.length) {
      and.push({
        $or: [
          { agent_ids: { $in: ids } },
          { assigned_agent_id: { $in: ids } },
        ],
      });
    }
  }

  if (filters.userIds?.length) {
    and.push({
      $or: [
        { primary_user_id: { $in: filters.userIds } },
        { user_ids: { $in: filters.userIds } },
      ],
    });
  }

  if (filters.channelIds?.length) {
    and.push({ channel_id: { $in: filters.channelIds } });
  } else if (filters.channel) {
    const re = filters.channel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    and.push({
      channel_name: { $regex: re, $options: "i" },
    });
  }

  if (filters.group) and.push({ group_name: filters.group });

  if (filters.resolved === "true") and.push({ resolved: true });
  if (filters.resolved === "false") and.push({ resolved: false });

  if (filters.reopened === "true") and.push({ reopened: true });
  if (filters.reopened === "false") and.push({ reopened: false });

  if (filters.csat === "rated") and.push({ "csat.rating": { $ne: null } });
  else if (filters.csat === "unrated") {
    and.push({
      $or: [{ csat: null }, { "csat.rating": null }],
    });
  } else if (filters.csat === "satisfied") {
    and.push({ "csat.rating": { $gte: 4 } });
  } else if (filters.csat === "dissatisfied") {
    and.push({ "csat.rating": { $lte: 2 } });
  } else if (filters.csat && /^[1-5]$/.test(filters.csat)) {
    and.push({ "csat.rating": Number(filters.csat) });
  }

  if (filters.q) {
    const re = {
      $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    const or: object[] = [
      { _id: re },
      { assigned_agent_name: re },
      { assigned_agent_id: re },
      { channel_name: re },
      { group_name: re },
      { "messages.text": re },
      { primary_user_id: re },
      { "resolution.label": re },
      { "resolution.sub_label": re },
      { "derived.subject": re },
    ];
    if (searchUserIds?.length) {
      or.push(
        { primary_user_id: { $in: searchUserIds } },
        { user_ids: { $in: searchUserIds } },
      );
    }
    and.push({ $or: or });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0] as Record<string, unknown>;
  return { $and: and };
}

export function sortSpec(filters: ConversationFilters): Record<string, 1 | -1> {
  const dir = filters.order === "asc" ? 1 : -1;
  switch (filters.sort) {
    case "csat":
      return { "csat.rating": dir, created_at: -1 };
    case "subject":
      return { "resolution.label": dir, "derived.subject": dir, created_at: -1 };
    case "agent":
      return { assigned_agent_name: dir, created_at: -1 };
    case "channel":
      return { channel_name: dir, created_at: -1 };
    case "group":
      return { group_name: dir, created_at: -1 };
    case "resolved":
      return { resolved: dir, created_at: -1 };
    case "reopened":
      return { reopened: dir, created_at: -1 };
    case "message_count":
      return { message_count: dir, created_at: -1 };
    case "frt":
      return { "metrics.first_response_time_seconds": dir, created_at: -1 };
    case "resolution_time":
      return { "metrics.resolution_time_seconds": dir, created_at: -1 };
    case "resolved_at":
      return { resolved_at: dir };
    case "updated_at":
      return { updated_at: dir };
    case "last_message_at":
      return { last_message_at: dir };
    default:
      return { created_at: dir };
  }
}

/** Mongo sort for customers collection fields. */
export function customerMongoSort(
  filters: ConversationFilters,
): Record<string, 1 | -1> | null {
  const dir = filters.order === "asc" ? 1 : -1;
  switch (filters.sort) {
    case "name":
      return { first_name: dir, last_name: dir };
    case "email":
      return { email: dir };
    case "phone":
      return { phone: dir };
    case "first_seen_at":
      return { "stats.first_seen_at": dir };
    case "last_seen_at":
      return { "stats.last_seen_at": dir };
    default:
      return null; // computed sorts handled in listCustomers
  }
}

export function defaultDateRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Serialize filters back to query string (for export / links). */
export function filtersToQuery(filters: ConversationFilters): string {
  const qs = new URLSearchParams();
  const set = (k: string, v?: string | number | null) => {
    if (v != null && v !== "") qs.set(k, String(v));
  };
  set("from", filters.from);
  set("to", filters.to);
  set("tz", filters.timeZone);
  set("subject", filters.subject);
  set("channel", filters.channel);
  set("group", filters.group);
  set("resolved", filters.resolved);
  set("reopened", filters.reopened);
  set("csat", filters.csat);
  set("q", filters.q);
  set("sort", filters.sort);
  set("order", filters.order);
  set("page", filters.page);
  set("limit", filters.limit);
  for (const id of filters.agentIds || []) qs.append("agent", id);
  for (const id of filters.userIds || []) qs.append("user", id);
  for (const id of filters.channelIds || []) qs.append("channelId", id);
  return qs.toString();
}
