import { collections } from "@/lib/db/client";
import {
  buildConversationMatch,
  sortSpec,
  type ConversationFilters,
} from "@/lib/filters";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getKpis(filters: ConversationFilters) {
  const { conversations } = await collections();
  const match = buildConversationMatch(filters);

  const [stats] = await conversations
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          uniqueUsers: { $addToSet: "$primary_user_id" },
          resolvedCount: {
            $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
          },
          reopenedCount: {
            $sum: { $cond: [{ $eq: ["$reopened", true] }, 1, 0] },
          },
          ratedCount: {
            $sum: {
              $cond: [{ $ne: ["$csat.rating", null] }, 1, 0],
            },
          },
          csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
          satisfiedCount: {
            $sum: {
              $cond: [{ $gte: ["$csat.rating", 4] }, 1, 0],
            },
          },
          labeledCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$resolution.label", null] },
                    { $ne: ["$resolution.label", ""] },
                  ],
                },
                1,
                0,
              ],
            },
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
          resTimeValues: {
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

  const total = stats?.total || 0;
  const uniqueUsers = (stats?.uniqueUsers || []).filter(Boolean).length;
  const ratedCount = stats?.ratedCount || 0;
  const resolvedCount = stats?.resolvedCount || 0;
  const frtAvg = avg((stats?.frtValues as number[]) || []);
  const resAvg = avg((stats?.resTimeValues as number[]) || []);

  const dailyVolume = await conversations
    .aggregate([
      { $match: { ...match, created_at: { $ne: null } } },
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

  const dailyCsat = await conversations
    .aggregate([
      { $match: { ...match, "csat.rating": { $ne: null } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$csat.submitted_at", "$created_at"] },
            },
          },
          average: { $avg: "$csat.rating" },
          ratedCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const csatDistribution = await conversations
    .aggregate([
      { $match: { ...match, "csat.rating": { $ne: null } } },
      { $group: { _id: "$csat.rating", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const bySubject = await conversations
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $cond: [
              {
                $or: [
                  { $eq: ["$derived.subject", null] },
                  { $eq: ["$derived.subject", ""] },
                ],
              },
              "(no Freshchat label)",
              "$derived.subject",
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ])
    .toArray();

  const byChannel = await conversations
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$channel_name", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  const averageCsatByAgent = await conversations
    .aggregate([
      { $match: { ...match, "csat.rating": { $ne: null } } },
      {
        $group: {
          _id: {
            id: { $ifNull: ["$assigned_agent_id", "unassigned"] },
            name: { $ifNull: ["$assigned_agent_name", "Unassigned"] },
          },
          average: { $avg: "$csat.rating" },
          ratedCount: { $sum: 1 },
        },
      },
      { $sort: { average: -1 } },
      { $limit: 15 },
    ])
    .toArray();

  // Deep breakdowns: channel / agent (who's responding) / group
  const [channelDeep, agentDeep, groupDeep] = await Promise.all([
    dimensionBreakdown(conversations, match, {
      id: { $literal: null },
      name: { $ifNull: ["$channel_name", "Unknown"] },
    }),
    dimensionBreakdown(conversations, match, {
      id: { $ifNull: ["$assigned_agent_id", "unassigned"] },
      name: { $ifNull: ["$assigned_agent_name", "Unassigned"] },
    }),
    dimensionBreakdown(conversations, match, {
      id: { $ifNull: ["$group_id", "none"] },
      name: { $ifNull: ["$group_name", "No group"] },
    }),
  ]);

  const unassignedCount = await conversations.countDocuments({
    ...match,
    $or: [
      { assigned_agent_id: null },
      { assigned_agent_id: { $exists: false } },
      { assigned_agent_id: "" },
    ],
  });

  return {
    kpis: {
      total,
      uniqueUsers,
      resolutionRate: total ? resolvedCount / total : null,
      reopenRate: total ? (stats?.reopenedCount || 0) / total : null,
      averageCsat: ratedCount ? stats.csatSum / ratedCount : null,
      ratedCount,
      csatResponseRate: total ? ratedCount / total : null,
      satisfiedRate: ratedCount ? stats.satisfiedCount / ratedCount : null,
      labelCoverage: total ? (stats?.labeledCount || 0) / total : null,
      avgMessages: total ? (stats?.messageSum || 0) / total : null,
      avgFirstResponseSeconds: frtAvg,
      avgResolutionSeconds: resAvg,
      unassignedCount,
      unassignedRate: total ? unassignedCount / total : null,
      agentCount: agentDeep.length,
      channelCount: channelDeep.length,
    },
    charts: {
      dailyVolume: dailyVolume.map((d) => ({
        date: d._id,
        count: d.count,
        resolved: d.resolved,
      })),
      dailyCsat: dailyCsat.map((d) => ({
        date: d._id,
        average: Number(d.average?.toFixed?.(2) ?? d.average),
        ratedCount: d.ratedCount,
      })),
      csatDistribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: csatDistribution.find((x) => x._id === rating)?.count || 0,
      })),
      bySubject: bySubject.map((s) => ({
        subject: s._id,
        label: s._id,
        count: s.count,
      })),
      byChannel: byChannel.map((c) => ({
        channel: c._id,
        count: c.count,
      })),
      averageCsatByAgent: averageCsatByAgent.map((a) => ({
        agentId: a._id.id,
        agentName: a._id.name,
        average: Number(a.average?.toFixed?.(2) ?? a.average),
        ratedCount: a.ratedCount,
      })),
      agentVolume: agentDeep.slice(0, 15).map((a) => ({
        agentId: a.id,
        agentName: a.name,
        count: a.conversations,
      })),
    },
    breakdowns: {
      byChannel: channelDeep,
      byAgent: agentDeep,
      byGroup: groupDeep,
    },
  };
}

type DimId = { id: unknown; name: unknown };

async function dimensionBreakdown(
  conversations: Awaited<ReturnType<typeof collections>>["conversations"],
  match: Record<string, unknown>,
  dim: DimId,
) {
  const rows = await conversations
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: dim,
          conversations: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
          },
          reopened: {
            $sum: { $cond: [{ $eq: ["$reopened", true] }, 1, 0] },
          },
          rated: {
            $sum: { $cond: [{ $ne: ["$csat.rating", null] }, 1, 0] },
          },
          csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
          satisfied: {
            $sum: { $cond: [{ $gte: ["$csat.rating", 4] }, 1, 0] },
          },
          messages: { $sum: { $ifNull: ["$message_count", 0] } },
          frtSum: {
            $sum: { $ifNull: ["$metrics.first_response_time_seconds", 0] },
          },
          frtCount: {
            $sum: {
              $cond: [
                { $ne: ["$metrics.first_response_time_seconds", null] },
                1,
                0,
              ],
            },
          },
          resSum: {
            $sum: { $ifNull: ["$metrics.resolution_time_seconds", 0] },
          },
          resCount: {
            $sum: {
              $cond: [
                { $ne: ["$metrics.resolution_time_seconds", null] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 25 },
    ])
    .toArray();

  return rows.map((r) => {
    const conversationsCount = r.conversations || 0;
    const rated = r.rated || 0;
    return {
      id: String(r._id?.id ?? r._id?.name ?? "unknown"),
      name: String(r._id?.name ?? "Unknown"),
      conversations: conversationsCount,
      resolved: r.resolved || 0,
      resolutionRate: conversationsCount ? r.resolved / conversationsCount : null,
      reopened: r.reopened || 0,
      reopenRate: conversationsCount ? r.reopened / conversationsCount : null,
      rated,
      avgCsat: rated ? r.csatSum / rated : null,
      satisfiedRate: rated ? r.satisfied / rated : null,
      csatResponseRate: conversationsCount ? rated / conversationsCount : null,
      avgMessages: conversationsCount ? r.messages / conversationsCount : null,
      avgFirstResponseSeconds: r.frtCount ? r.frtSum / r.frtCount : null,
      avgResolutionSeconds: r.resCount ? r.resSum / r.resCount : null,
    };
  });
}

export async function listConversations(filters: ConversationFilters) {
  const { conversations, users } = await collections();
  const match = buildConversationMatch(filters);
  const totalItems = await conversations.countDocuments(match);
  const items = await conversations
    .find(match)
    .sort(sortSpec(filters))
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit)
    .toArray();

  const userIds = [
    ...new Set(items.map((i) => i.primary_user_id).filter(Boolean)),
  ] as string[];
  const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
  const userMap = new Map(userDocs.map((u) => [u._id, u]));

  return {
    items: items.map((c) => {
      const u = c.primary_user_id ? userMap.get(c.primary_user_id) : null;
      const name = u
        ? [u.first_name, u.last_name].filter(Boolean).join(" ") || null
        : null;
      const subjectLabel =
        c.derived?.subject ||
        c.resolution?.label ||
        "";
      return {
        id: c._id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        resolvedAt: c.resolved_at,
        channel: c.channel_name,
        group: c.group_name,
        user: {
          id: c.primary_user_id,
          name,
          email: u?.email || null,
          phone: u?.phone || null,
        },
        subject: {
          slug: subjectLabel || "unlabeled",
          label: subjectLabel || "(no Freshchat label)",
          source: c.derived?.subject_source || "none",
          confidence: c.derived?.confidence ?? null,
        },
        resolutionLabel: c.resolution?.label || null,
        resolutionSubLabel: c.resolution?.sub_label || null,
        agent: {
          id: c.assigned_agent_id,
          name: c.assigned_agent_name || "Unassigned",
        },
        status: c.status,
        resolved: c.resolved,
        reopened: c.reopened,
        csat: c.csat?.rating ?? null,
        csatComment: c.csat?.comment || null,
        messageCount: c.message_count,
        firstResponseSeconds: c.metrics?.first_response_time_seconds ?? null,
        resolutionSeconds: c.metrics?.resolution_time_seconds ?? null,
        preview: c.messages.find((m) => m.actor_type === "user")?.text || "",
        conversationUrl: c.conversation_url,
        isStub: c.is_stub,
      };
    }),
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / filters.limit)),
  };
}

export async function getConversation(id: string) {
  const { conversations, users } = await collections();
  const c = await conversations.findOne({ _id: id });
  if (!c) return null;

  const u = c.primary_user_id
    ? await users.findOne({ _id: c.primary_user_id })
    : null;

  const subjectLabel = c.derived?.subject || c.resolution?.label || "";

  return {
    id: c._id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    resolvedAt: c.resolved_at,
    status: c.status,
    resolved: c.resolved,
    reopened: c.reopened,
    isStub: c.is_stub,
    channel: c.channel_name,
    group: c.group_name,
    conversationUrl: c.conversation_url,
    metrics: c.metrics || {
      first_response_time_seconds: null,
      resolution_time_seconds: null,
      response_time_seconds: null,
    },
    csat: c.csat
      ? {
          rating: c.csat.rating,
          ratingRaw: c.csat.rating_raw,
          feedback: c.csat.comment,
          submittedAt: c.csat.submitted_at,
        }
      : null,
    user: {
      id: c.primary_user_id,
      name: u
        ? [u.first_name, u.last_name].filter(Boolean).join(" ") || null
        : null,
      email: u?.email || null,
      phone: u?.phone || null,
      properties: u?.properties || {},
    },
    agent: {
      id: c.assigned_agent_id,
      name: c.assigned_agent_name || "Unassigned",
    },
    subject: {
      slug: subjectLabel || "unlabeled",
      label: subjectLabel || "(no Freshchat label)",
      source: c.derived?.subject_source || "none",
      confidence: c.derived?.confidence ?? null,
    },
    labels: c.resolution
      ? [
          {
            category: c.resolution.label,
            subcategory: c.resolution.sub_label,
          },
        ]
      : [],
    messages: c.messages.map((m) => ({
      id: m.message_id,
      actorType: m.actor_type,
      actorId: m.actor_id,
      actorName:
        [m.actor_first_name, m.actor_last_name].filter(Boolean).join(" ") ||
        null,
      actorEmail: m.actor_email,
      body: m.text,
      contentType: m.message_type || "text",
      messageSource: m.message_source,
      createdAt: m.created_at,
      hasAttachment: m.has_attachment,
    })),
  };
}

export async function exportConversationsCsv(filters: ConversationFilters) {
  const { conversations, users } = await collections();
  const match = buildConversationMatch({ ...filters, page: 1, limit: 25 });
  const items = await conversations
    .find(match)
    .sort(sortSpec(filters))
    .limit(10000)
    .toArray();

  const userIds = [
    ...new Set(items.map((i) => i.primary_user_id).filter(Boolean)),
  ] as string[];
  const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
  const userMap = new Map(userDocs.map((u) => [u._id, u]));

  const headers = [
    "conversation_id",
    "created_at",
    "resolved_at",
    "resolved",
    "reopened",
    "status",
    "channel",
    "group",
    "user_id",
    "user_name",
    "user_email",
    "user_phone",
    "agent_id",
    "agent_name",
    "resolution_label",
    "resolution_sub_label",
    "csat_rating",
    "csat_rating_raw",
    "csat_comment",
    "csat_submitted_at",
    "message_count",
    "first_response_seconds",
    "resolution_seconds",
    "conversation_url",
    "preview",
  ];

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.join(",")];
  for (const c of items) {
    const u = c.primary_user_id ? userMap.get(c.primary_user_id) : null;
    const name = u
      ? [u.first_name, u.last_name].filter(Boolean).join(" ")
      : "";
    lines.push(
      [
        c._id,
        c.created_at?.toISOString?.() || "",
        c.resolved_at?.toISOString?.() || "",
        c.resolved,
        c.reopened,
        c.status,
        c.channel_name,
        c.group_name,
        c.primary_user_id,
        name,
        u?.email,
        u?.phone,
        c.assigned_agent_id,
        c.assigned_agent_name,
        c.resolution?.label,
        c.resolution?.sub_label,
        c.csat?.rating,
        c.csat?.rating_raw,
        c.csat?.comment,
        c.csat?.submitted_at?.toISOString?.() || "",
        c.message_count,
        c.metrics?.first_response_time_seconds,
        c.metrics?.resolution_time_seconds,
        c.conversation_url,
        c.messages.find((m) => m.actor_type === "user")?.text || "",
      ]
        .map(escape)
        .join(","),
    );
  }

  return lines.join("\n");
}

export async function getSyncStatus() {
  const { syncRuns, conversations } = await collections();
  const latest = await syncRuns.find({}).sort({ started_at: -1 }).limit(1).next();
  const count = await conversations.estimatedDocumentCount();

  if (!latest) {
    return {
      state: "never_run" as const,
      lastStartedAt: null,
      lastCompletedAt: null,
      conversationsProcessed: count,
      failedRecords: 0,
      counters: null,
    };
  }

  return {
    state:
      latest.status === "running"
        ? ("running" as const)
        : latest.status === "failed"
          ? ("failed" as const)
          : latest.status === "partial"
            ? ("partial" as const)
            : ("idle" as const),
    lastStartedAt: latest.started_at,
    lastCompletedAt: latest.finished_at,
    conversationsProcessed: count,
    failedRecords: latest.counters.windows_failed + latest.errors.length,
    counters: latest.counters,
  };
}
