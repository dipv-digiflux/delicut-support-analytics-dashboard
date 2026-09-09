export interface ConversationFilters {
  from?: string;
  to?: string;
  subject?: string;
  agent?: string;
  channel?: string;
  group?: string;
  resolved?: "true" | "false";
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
  "csat",
  "subject",
  "agent",
]);

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
  const limit = [10, 25, 40, 50, 100].includes(limitRaw) ? limitRaw : 25;

  return {
    from: get("from"),
    to: get("to"),
    subject: get("subject"),
    agent: get("agent"),
    channel: get("channel"),
    group: get("group"),
    resolved: get("resolved") as "true" | "false" | undefined,
    csat: get("csat"),
    q: get("q"),
    page,
    limit,
    sort,
    order,
  };
}

/** Inclusive calendar dates as UTC days of `from`/`to` (YYYY-MM-DD).  
 * `REPORTING_TIMEZONE` is a display label only — date filters are UTC. */
export function buildConversationMatch(
  filters: ConversationFilters,
): Record<string, unknown> {
  const and: object[] = [];

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) {
      range.$gte = new Date(`${filters.from}T00:00:00.000Z`);
    }
    if (filters.to) {
      const end = new Date(`${filters.to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      range.$lt = end;
    }
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

  if (filters.agent === "unassigned") {
    and.push({
      $or: [
        { assigned_agent_id: null },
        { assigned_agent_id: { $exists: false } },
        { assigned_agent_id: "" },
      ],
    });
  } else if (filters.agent) {
    and.push({ assigned_agent_id: filters.agent });
  }

  if (filters.channel) and.push({ channel_name: filters.channel });
  if (filters.group) and.push({ group_name: filters.group });

  if (filters.resolved === "true") and.push({ resolved: true });
  if (filters.resolved === "false") and.push({ resolved: false });

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
    and.push({
      $or: [
        { _id: re },
        { assigned_agent_name: re },
        { channel_name: re },
        { "messages.text": re },
        { primary_user_id: re },
        { "resolution.label": re },
      ],
    });
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
      return { "derived.subject": dir, created_at: -1 };
    case "agent":
      return { assigned_agent_name: dir, created_at: -1 };
    case "resolved_at":
      return { resolved_at: dir };
    case "updated_at":
      return { updated_at: dir };
    default:
      return { created_at: dir };
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
