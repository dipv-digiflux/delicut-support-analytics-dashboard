import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { buildConversationMatch, type ConversationFilters } from "@/lib/filters";
import { resolveSearchUserIds } from "@/lib/search";

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u._id;
}

export async function listResponders(opts: {
  q?: string;
  page: number;
  limit: number;
}) {
  const { users, conversations } = await collections();
  const limit = opts.limit;
  const skip = (opts.page - 1) * limit;
  const filter: Record<string, unknown> = { role: "agent" };

  if (opts.q?.trim()) {
    const q = opts.q.trim();
    const re = {
      $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    filter.$or = [
      { _id: q },
      { first_name: re },
      { last_name: re },
      { email: re },
      { phone: re },
    ];
  }

  const totalItems = await users.countDocuments(filter);
  const rows = await users
    .find(filter)
    .sort({ "stats.last_seen_at": -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const ids = rows.map((u) => u._id);
  const stats =
    ids.length === 0
      ? []
      : await conversations
          .aggregate([
            {
              $match: {
                $or: [
                  { assigned_agent_id: { $in: ids } },
                  { agent_ids: { $in: ids } },
                ],
              },
            },
            {
              $group: {
                _id: {
                  $ifNull: ["$assigned_agent_id", { $arrayElemAt: ["$agent_ids", 0] }],
                },
                conversationCount: { $sum: 1 },
                resolvedCount: {
                  $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
                },
                ratedCount: {
                  $sum: { $cond: [{ $ne: ["$csat.rating", null] }, 1, 0] },
                },
                csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
                channels: { $addToSet: "$channel_name" },
              },
            },
          ])
          .toArray();

  const map = new Map(stats.map((s) => [s._id as string, s]));

  return {
    items: rows.map((u) => {
      const s = map.get(u._id);
      const rated = (s?.ratedCount as number) || 0;
      const csatSum = (s?.csatSum as number) || 0;
      return {
        id: u._id,
        name: displayName(u),
        email: u.email,
        phone: u.phone,
        firstSeenAt: u.stats?.first_seen_at ?? null,
        lastSeenAt: u.stats?.last_seen_at ?? null,
        conversationCount: (s?.conversationCount as number) ?? u.stats?.conversation_count ?? 0,
        resolvedCount: (s?.resolvedCount as number) ?? 0,
        avgCsat: rated ? csatSum / rated : null,
        channels: ((s?.channels as (string | null)[]) || []).filter(Boolean) as string[],
      };
    }),
    totalItems,
    page: opts.page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  };
}

export async function getResponder(id: string) {
  const { users } = await collections();
  const u = await users.findOne({ _id: id, role: "agent" });
  if (!u) return null;
  return {
    id: u._id,
    name: displayName(u),
    email: u.email,
    phone: u.phone,
    firstName: u.first_name,
    lastName: u.last_name,
    properties: u.properties || {},
    enrichment: u.enrichment,
    stats: u.stats,
    raw: u,
  };
}

export async function getResponderAnalytics(
  agentId: string,
  filters: ConversationFilters,
) {
  const { conversations } = await collections();
  const searchUserIds = filters.q?.trim()
    ? await resolveSearchUserIds(filters.q)
    : [];
  const base = buildConversationMatch(
    {
      ...filters,
      agentIds: [agentId],
      agent: agentId,
    },
    searchUserIds,
  );

  const [stats] = await conversations
    .aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolvedCount: {
            $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
          },
          ratedCount: {
            $sum: { $cond: [{ $ne: ["$csat.rating", null] }, 1, 0] },
          },
          csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
          satisfiedCount: {
            $sum: { $cond: [{ $gte: ["$csat.rating", 4] }, 1, 0] },
          },
          messageSum: { $sum: { $ifNull: ["$message_count", 0] } },
          frtValues: {
            $push: {
              $cond: [
                { $ne: ["$metrics.first_response_time_seconds", null] },
                "$metrics.first_response_time_seconds",
                "$$REMOVE",
              ],
            },
          },
          resValues: {
            $push: {
              $cond: [
                { $ne: ["$metrics.resolution_time_seconds", null] },
                "$metrics.resolution_time_seconds",
                "$$REMOVE",
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const byChannel = await conversations
    .aggregate([
      { $match: base },
      {
        $group: {
          _id: { $ifNull: ["$channel_name", "Unknown"] },
          count: { $sum: 1 },
          avgCsat: { $avg: "$csat.rating" },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();

  const byDay = await conversations
    .aggregate([
      { $match: { ...base, created_at: { $ne: null } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const recent = await conversations
    .find(base)
    .sort({ created_at: -1 })
    .limit(getConfig().UI_DEFAULT_PAGE_SIZE || 20)
    .project({
      channel_name: 1,
      created_at: 1,
      resolved: 1,
      assigned_agent_name: 1,
      primary_user_id: 1,
      "csat.rating": 1,
      "resolution.label": 1,
      message_count: 1,
    })
    .toArray();

  const total = (stats?.total as number) || 0;
  const rated = (stats?.ratedCount as number) || 0;
  const frt = ((stats?.frtValues as number[]) || []).filter((n) => n != null);
  const res = ((stats?.resValues as number[]) || []).filter((n) => n != null);

  return {
    kpis: {
      total,
      resolvedCount: (stats?.resolvedCount as number) || 0,
      resolutionRate: total ? ((stats?.resolvedCount as number) || 0) / total : null,
      ratedCount: rated,
      averageCsat: rated ? ((stats?.csatSum as number) || 0) / rated : null,
      satisfiedRate: rated
        ? ((stats?.satisfiedCount as number) || 0) / rated
        : null,
      avgMessages: total ? ((stats?.messageSum as number) || 0) / total : null,
      avgFirstResponseSeconds: frt.length
        ? frt.reduce((a, b) => a + b, 0) / frt.length
        : null,
      avgResolutionSeconds: res.length
        ? res.reduce((a, b) => a + b, 0) / res.length
        : null,
    },
    byChannel: byChannel.map((r) => ({
      channel: r._id as string,
      count: r.count as number,
      avgCsat: (r.avgCsat as number) ?? null,
    })),
    byDay: byDay.map((r) => ({
      date: r._id as string,
      count: r.count as number,
      resolved: r.resolved as number,
    })),
    recent: recent.map((c) => ({
      id: c._id,
      channel: c.channel_name,
      createdAt: c.created_at,
      resolved: c.resolved,
      csat: c.csat?.rating ?? null,
      label: c.resolution?.label ?? null,
      messageCount: c.message_count,
      userId: c.primary_user_id,
    })),
  };
}
