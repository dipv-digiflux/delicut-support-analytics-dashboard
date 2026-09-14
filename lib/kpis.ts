import { collections } from "@/lib/db/client";
import { KPI_PROJECT } from "@/lib/conversation-stats";
import {
  buildConversationMatch,
  type ConversationFilters,
} from "@/lib/filters";
import { resolveSearchUserIds } from "@/lib/search";

const HAS_CSAT_RATING = {
  $in: [{ $type: "$csat.rating" }, ["double", "int", "long", "decimal"]],
} as const;

const HAS_RESOLUTION_LABEL = {
  $and: [
    { $eq: [{ $type: "$resolution.label" }, "string"] },
    { $ne: ["$resolution.label", ""] },
  ],
} as const;

type DimId = { id: unknown; name: unknown };

const DIM_METRICS = {
  conversations: { $sum: 1 },
  resolved: { $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] } },
  reopened: { $sum: { $cond: [{ $eq: ["$reopened", true] }, 1, 0] } },
  rated: { $sum: { $cond: [HAS_CSAT_RATING, 1, 0] } },
  csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
  satisfied: {
    $sum: {
      $cond: [{ $and: [HAS_CSAT_RATING, { $gte: ["$csat.rating", 4] }] }, 1, 0],
    },
  },
  messages: { $sum: { $ifNull: ["$message_count", 0] } },
  frtSum: { $sum: { $ifNull: ["$metrics.first_response_time_seconds", 0] } },
  frtCount: {
    $sum: {
      $cond: [{ $ne: ["$metrics.first_response_time_seconds", null] }, 1, 0],
    },
  },
  resSum: { $sum: { $ifNull: ["$metrics.resolution_time_seconds", 0] } },
  resCount: {
    $sum: {
      $cond: [{ $ne: ["$metrics.resolution_time_seconds", null] }, 1, 0],
    },
  },
} as const;

function dimPipeline(dim: DimId) {
  return [
    { $group: { _id: dim, ...DIM_METRICS } },
    { $sort: { conversations: -1 as const } },
    { $limit: 25 },
  ];
}

function mapDimRows(
  rows: Array<{
    _id?: { id?: unknown; name?: unknown };
    conversations?: number;
    resolved?: number;
    reopened?: number;
    rated?: number;
    csatSum?: number;
    satisfied?: number;
    messages?: number;
    frtSum?: number;
    frtCount?: number;
    resSum?: number;
    resCount?: number;
  }>,
) {
  return rows.map((r) => {
    const conversationsCount = r.conversations || 0;
    const rated = r.rated || 0;
    return {
      id: String(r._id?.id ?? r._id?.name ?? "unknown"),
      name: String(r._id?.name ?? "Unknown"),
      conversations: conversationsCount,
      resolved: r.resolved || 0,
      resolutionRate: conversationsCount ? r.resolved! / conversationsCount : null,
      reopened: r.reopened || 0,
      reopenRate: conversationsCount ? (r.reopened || 0) / conversationsCount : null,
      rated,
      avgCsat: rated ? (r.csatSum || 0) / rated : null,
      satisfiedRate: rated ? (r.satisfied || 0) / rated : null,
      csatResponseRate: conversationsCount ? rated / conversationsCount : null,
      avgMessages: conversationsCount
        ? (r.messages || 0) / conversationsCount
        : null,
      avgFirstResponseSeconds: r.frtCount
        ? (r.frtSum || 0) / r.frtCount
        : null,
      avgResolutionSeconds: r.resCount ? (r.resSum || 0) / r.resCount : null,
    };
  });
}

async function matchFor(filters: ConversationFilters) {
  const searchUserIds = filters.q?.trim()
    ? await resolveSearchUserIds(filters.q)
    : [];
  return buildConversationMatch(filters, searchUserIds);
}

const UNLABELED_SUBJECT = {
  $or: [
    { $eq: ["$derived.subject", null] },
    { $eq: ["$derived.subject", ""] },
  ],
} as const;

function voiceFacetBranches() {
  const subjectId = {
    $cond: [UNLABELED_SUBJECT, "unlabeled", "$derived.subject"],
  };
  return {
    recentOpeners: [
      { $match: { preview_text: { $type: "string" as const, $ne: "" } } },
      { $limit: 400 },
      {
        $project: {
          text: "$preview_text",
          subject: subjectId,
          resolved: 1,
        },
      },
    ],
    csatQuotes: [
      { $match: { "csat.comment": { $type: "string" as const, $ne: "" } } },
      { $limit: 20 },
      {
        $project: {
          comment: "$csat.comment",
          rating: "$csat.rating",
          subject: subjectId,
        },
      },
    ],
    subjectSamples: [
      { $match: { preview_text: { $type: "string" as const, $ne: "" } } },
      {
        $group: {
          _id: subjectId,
          count: { $sum: 1 },
          samples: {
            $topN: {
              n: 3,
              sortBy: { created_at: -1 as const },
              output: "$preview_text",
            },
          },
        },
      },
      { $sort: { count: -1 as const } },
      { $limit: 8 },
    ],
  };
}

/** One $match + $project + $facet so year-range dashboards scan conversations once. */
export async function getKpis(
  filters: ConversationFilters,
  opts: { voice?: boolean } = {},
) {
  const { conversations } = await collections();
  const match = await matchFor(filters);
  const tz = filters.timeZone || "Asia/Dubai";
  const voiceBranches = opts.voice ? voiceFacetBranches() : {};

  const [facet] = await conversations
    .aggregate(
      [
        { $match: match },
        { $project: KPI_PROJECT },
        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  resolvedCount: {
                    $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] },
                  },
                  openCount: {
                    $sum: { $cond: [{ $eq: ["$resolved", true] }, 0, 1] },
                  },
                  reopenedCount: {
                    $sum: { $cond: [{ $eq: ["$reopened", true] }, 1, 0] },
                  },
                  ratedCount: { $sum: { $cond: [HAS_CSAT_RATING, 1, 0] } },
                  csatSum: { $sum: { $ifNull: ["$csat.rating", 0] } },
                  satisfiedCount: {
                    $sum: {
                      $cond: [
                        { $and: [HAS_CSAT_RATING, { $gte: ["$csat.rating", 4] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  dissatisfiedCount: {
                    $sum: {
                      $cond: [
                        { $and: [HAS_CSAT_RATING, { $lte: ["$csat.rating", 2] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  labeledCount: {
                    $sum: { $cond: [HAS_RESOLUTION_LABEL, 1, 0] },
                  },
                  messageSum: { $sum: { $ifNull: ["$message_count", 0] } },
                  withAttachments: {
                    $sum: {
                      $cond: [{ $eq: ["$has_attachment", true] }, 1, 0],
                    },
                  },
                  unassignedCount: {
                    $sum: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$assigned_agent_id", null] },
                            { $eq: ["$assigned_agent_id", ""] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  frtAvg: { $avg: "$metrics.first_response_time_seconds" },
                  frtMedian: {
                    $percentile: {
                      input: "$metrics.first_response_time_seconds",
                      p: [0.5],
                      method: "approximate",
                    },
                  },
                  resAvg: { $avg: "$metrics.resolution_time_seconds" },
                  resMedian: {
                    $percentile: {
                      input: "$metrics.resolution_time_seconds",
                      p: [0.5],
                      method: "approximate",
                    },
                  },
                  userActors: { $sum: { $ifNull: ["$actor_counts.user", 0] } },
                  agentActors: { $sum: { $ifNull: ["$actor_counts.agent", 0] } },
                  botActors: { $sum: { $ifNull: ["$actor_counts.bot", 0] } },
                  systemActors: {
                    $sum: { $ifNull: ["$actor_counts.system", 0] },
                  },
                  botOnlyCount: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {
                              $gt: [{ $ifNull: ["$actor_counts.bot", 0] }, 0],
                            },
                            {
                              $eq: [
                                { $ifNull: ["$actor_counts.agent", 0] },
                                0,
                              ],
                            },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  botInvolvedCount: {
                    $sum: {
                      $cond: [
                        { $gt: [{ $ifNull: ["$actor_counts.bot", 0] }, 0] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            uniqueUsers: [
              { $group: { _id: "$primary_user_id" } },
              { $match: { _id: { $nin: [null, ""] } } },
              { $count: "n" },
            ],
            dailyVolume: [
              { $match: { created_at: { $ne: null } } },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            dailyResolved: [
              { $match: { resolved: true, resolved_at: { $ne: null } } },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$resolved_at" },
                  },
                  resolved: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            dailyCsat: [
              { $match: { "csat.rating": { $ne: null } } },
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
            ],
            csatDistribution: [
              { $match: { "csat.rating": { $ne: null } } },
              { $group: { _id: "$csat.rating", count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],
            subjectDeep: dimPipeline({
              id: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$derived.subject", null] },
                      { $eq: ["$derived.subject", ""] },
                    ],
                  },
                  "unlabeled",
                  "$derived.subject",
                ],
              },
              name: {
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
            }),
            averageCsatByAgent: [
              { $match: { "csat.rating": { $ne: null } } },
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
            ],
            channelDeep: dimPipeline({
              id: { $literal: null },
              name: { $ifNull: ["$channel_name", "Unknown"] },
            }),
            agentDeep: dimPipeline({
              id: { $ifNull: ["$assigned_agent_id", "unassigned"] },
              name: { $ifNull: ["$assigned_agent_name", "Unassigned"] },
            }),
            groupDeep: dimPipeline({
              id: { $ifNull: ["$group_id", "none"] },
              name: { $ifNull: ["$group_name", "No group"] },
            }),
            volumeHeatmap: [
              { $match: { created_at: { $ne: null } } },
              {
                $group: {
                  _id: {
                    dow: { $dayOfWeek: { date: "$created_at", timezone: tz } },
                    hour: { $hour: { date: "$created_at", timezone: tz } },
                  },
                  count: { $sum: 1 },
                },
              },
            ],
            frtBuckets: [
              { $match: { "metrics.first_response_time_seconds": { $ne: null } } },
              {
                $bucket: {
                  groupBy: "$metrics.first_response_time_seconds",
                  boundaries: [0, 60, 300, 900, 3600, 14400, 99999999],
                  default: "other",
                  output: { count: { $sum: 1 } },
                },
              },
            ],
            resolveBuckets: [
              { $match: { "metrics.resolution_time_seconds": { $ne: null } } },
              {
                $bucket: {
                  groupBy: "$metrics.resolution_time_seconds",
                  boundaries: [0, 900, 3600, 14400, 86400, 259200, 99999999],
                  default: "other",
                  output: { count: { $sum: 1 } },
                },
              },
            ],
            csatByChannel: [
              {
                $match: {
                  "csat.rating": { $ne: null },
                  channel_name: { $ne: null },
                },
              },
              {
                $group: {
                  _id: "$channel_name",
                  average: { $avg: "$csat.rating" },
                  ratedCount: { $sum: 1 },
                },
              },
              { $sort: { ratedCount: -1 } },
              { $limit: 10 },
            ],
            labelTrend: [
              { $match: { created_at: { $ne: null } } },
              {
                $addFields: {
                  _label: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$derived.subject", null] },
                          { $eq: ["$derived.subject", ""] },
                          { $eq: [{ $ifNull: ["$resolution.label", ""] }, ""] },
                        ],
                      },
                      "unlabeled",
                      {
                        $ifNull: [
                          "$derived.subject",
                          { $ifNull: ["$resolution.label", "unlabeled"] },
                        ],
                      },
                    ],
                  },
                  _day: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$created_at",
                      timezone: tz,
                    },
                  },
                },
              },
              {
                $group: {
                  _id: { day: "$_day", label: "$_label" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { "_id.day": 1 } },
            ],
            ...voiceBranches,
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  const stats = facet?.stats?.[0];
  const total = stats?.total || 0;
  const uniqueUsers = facet?.uniqueUsers?.[0]?.n || 0;
  const ratedCount = stats?.ratedCount || 0;
  const resolvedCount = stats?.resolvedCount || 0;
  const openCount = stats?.openCount || 0;
  const dissatisfiedCount = stats?.dissatisfiedCount || 0;
  const withAttachments = stats?.withAttachments || 0;
  const unassignedCount = stats?.unassignedCount || 0;
  const labeledCount = stats?.labeledCount || 0;
  const unlabeledCount = Math.max(0, total - labeledCount);
  const botOnlyCount = stats?.botOnlyCount || 0;
  const botInvolvedCount = stats?.botInvolvedCount || 0;
  const frtAvg =
    typeof stats?.frtAvg === "number" ? (stats.frtAvg as number) : null;
  const resAvg =
    typeof stats?.resAvg === "number" ? (stats.resAvg as number) : null;
  const frtMedian = Array.isArray(stats?.frtMedian)
    ? ((stats.frtMedian as number[])[0] ?? null)
    : null;
  const resMedian = Array.isArray(stats?.resMedian)
    ? ((stats.resMedian as number[])[0] ?? null)
    : null;

  const dailyResolved = facet?.dailyResolved || [];
  const dailyVolume = facet?.dailyVolume || [];
  const resolvedByDay = new Map<string, number>(
    dailyResolved.map((d: { _id: string; resolved: number }) => [
      String(d._id),
      Number(d.resolved),
    ]),
  );
  const createdByDay = new Map<string, number>(
    dailyVolume.map((d: { _id: string; count: number }) => [
      String(d._id),
      Number(d.count),
    ]),
  );
  const allDays = [
    ...new Set([...createdByDay.keys(), ...resolvedByDay.keys()]),
  ].sort();
  const dailyVolumeMerged = allDays.map((date) => ({
    date,
    count: Number(createdByDay.get(date) || 0),
    resolved: Number(resolvedByDay.get(date) || 0),
  }));

  const FRT_BUCKET_LABELS = [
    { key: 0, label: "<1m" },
    { key: 60, label: "1–5m" },
    { key: 300, label: "5–15m" },
    { key: 900, label: "15–60m" },
    { key: 3600, label: "1–4h" },
    { key: 14400, label: ">4h" },
  ];
  const RES_BUCKET_LABELS = [
    { key: 0, label: "<15m" },
    { key: 900, label: "15–60m" },
    { key: 3600, label: "1–4h" },
    { key: 14400, label: "4–24h" },
    { key: 86400, label: "1–3d" },
    { key: 259200, label: ">3d" },
  ];

  const frtBucketsRaw = facet?.frtBuckets || [];
  const resolveBucketsRaw = facet?.resolveBuckets || [];
  const frtMap = new Map<number | string, number>(
    frtBucketsRaw.map((b: { _id: number | string; count: number }) => [
      b._id,
      Number(b.count),
    ]),
  );
  const resMap = new Map<number | string, number>(
    resolveBucketsRaw.map((b: { _id: number | string; count: number }) => [
      b._id,
      Number(b.count),
    ]),
  );

  const heatmapCells = (facet?.volumeHeatmap || []).map(
    (r: { _id: { dow: number; hour: number }; count: number }) => {
      const mongoDow = Number(r._id.dow);
      const weekday = mongoDow === 1 ? 6 : mongoDow - 2;
      return { weekday, hour: Number(r._id.hour), count: r.count };
    },
  );

  const labelTrendRaw = facet?.labelTrend || [];
  const labelTotals = new Map<string, number>();
  for (const row of labelTrendRaw as {
    _id: { day: string; label: string };
    count: number;
  }[]) {
    const label = String(row._id.label);
    labelTotals.set(label, (labelTotals.get(label) || 0) + row.count);
  }
  const topLabels = [...labelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l]) => l);
  const labelDays = [
    ...new Set(
      (labelTrendRaw as { _id: { day: string } }[]).map((r) => String(r._id.day)),
    ),
  ].sort();
  const labelTrend = {
    days: labelDays,
    series: topLabels.map((label) => ({
      label,
      counts: labelDays.map((day) => {
        const hit = (
          labelTrendRaw as { _id: { day: string; label: string }; count: number }[]
        ).find(
          (r) => String(r._id.day) === day && String(r._id.label) === label,
        );
        return hit?.count || 0;
      }),
    })),
  };

  const actorShare = (
    [
      ["user", stats?.userActors],
      ["agent", stats?.agentActors],
      ["bot", stats?.botActors],
      ["system", stats?.systemActors],
    ] as const
  )
    .map(([actor, count]) => ({ actor, count: Number(count || 0) }))
    .filter((a) => a.count > 0);

  const channelDeep = mapDimRows(facet?.channelDeep || []);
  const agentDeep = mapDimRows(facet?.agentDeep || []);
  const groupDeep = mapDimRows(facet?.groupDeep || []);
  const subjectDeep = mapDimRows(facet?.subjectDeep || []);
  const dailyCsat = facet?.dailyCsat || [];
  const csatDistribution = facet?.csatDistribution || [];
  const averageCsatByAgent = facet?.averageCsatByAgent || [];
  const csatByChannelRaw = facet?.csatByChannel || [];

  return {
    kpis: {
      total,
      uniqueUsers,
      openCount,
      openRate: total ? openCount / total : null,
      resolutionRate: total ? resolvedCount / total : null,
      reopenRate: total ? (stats?.reopenedCount || 0) / total : null,
      averageCsat: ratedCount ? stats.csatSum / ratedCount : null,
      ratedCount,
      csatResponseRate: total ? ratedCount / total : null,
      satisfiedRate: ratedCount ? stats.satisfiedCount / ratedCount : null,
      dissatisfiedRate: ratedCount ? dissatisfiedCount / ratedCount : null,
      labelCoverage: total ? labeledCount / total : null,
      unlabeledCount,
      avgMessages: total ? (stats?.messageSum || 0) / total : null,
      avgFirstResponseSeconds: frtAvg,
      medianFirstResponseSeconds: frtMedian,
      avgResolutionSeconds: resAvg,
      medianResolutionSeconds: resMedian,
      chatsWithAttachments: withAttachments,
      attachmentRate: total ? withAttachments / total : null,
      unassignedCount,
      unassignedRate: total ? unassignedCount / total : null,
      agentCount: agentDeep.length,
      channelCount: channelDeep.length,
      groupCount: groupDeep.length,
      botOnlyCount,
      botOnlyRate: total ? botOnlyCount / total : null,
      botInvolvedCount,
      botInvolvedRate: total ? botInvolvedCount / total : null,
    },
    charts: {
      dailyVolume: dailyVolumeMerged,
      dailyCsat: dailyCsat.map((d: { _id: string; average: number; ratedCount: number }) => ({
        date: d._id,
        average: Number(d.average?.toFixed?.(2) ?? d.average),
        ratedCount: d.ratedCount,
      })),
      csatDistribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count:
          csatDistribution.find((x: { _id: number }) => x._id === rating)?.count ||
          0,
      })),
      bySubject: subjectDeep.slice(0, 15).map((s) => ({
        subject: s.id,
        label: s.name,
        count: s.conversations,
      })),
      byChannel: channelDeep.slice(0, 10).map((c) => ({
        channel: c.name,
        count: c.conversations,
      })),
      averageCsatByAgent: averageCsatByAgent.map(
        (a: {
          _id: { id: string; name: string };
          average: number;
          ratedCount: number;
        }) => ({
          agentId: a._id.id,
          agentName: a._id.name,
          average: Number(a.average?.toFixed?.(2) ?? a.average),
          ratedCount: a.ratedCount,
        }),
      ),
      agentVolume: agentDeep.slice(0, 15).map((a) => ({
        agentId: a.id,
        agentName: a.name,
        count: a.conversations,
      })),
      volumeHeatmap: heatmapCells,
      frtDistribution: FRT_BUCKET_LABELS.map((b) => ({
        bucket: b.label,
        count: Number(frtMap.get(b.key) || 0),
      })),
      resolutionDistribution: RES_BUCKET_LABELS.map((b) => ({
        bucket: b.label,
        count: Number(resMap.get(b.key) || 0),
      })),
      actorShare,
      resolvedMix: [
        { status: "Resolved", count: resolvedCount },
        { status: "Open", count: openCount },
      ].filter((r) => r.count > 0),
      csatByChannel: csatByChannelRaw.map(
        (c: { _id: string; average: number; ratedCount: number }) => ({
          channel: String(c._id),
          average: Number(c.average?.toFixed?.(2) ?? c.average),
          ratedCount: c.ratedCount,
        }),
      ),
      labelTrend,
    },
    breakdowns: {
      byChannel: channelDeep,
      byAgent: agentDeep,
      byGroup: groupDeep,
      bySubject: subjectDeep,
    },
    voice: {
      sampled: (facet?.recentOpeners || []).length,
      openers: (facet?.recentOpeners || []).map(
        (r: {
          _id?: unknown;
          text?: string;
          subject?: string;
          resolved?: boolean;
        }) => ({
          id: String(r._id ?? ""),
          text: String(r.text || "").trim(),
          subject: String(r.subject || "unlabeled"),
          resolved: r.resolved === true,
        }),
      ).filter((r: { text: string }) => r.text),
      quotes: (facet?.csatQuotes || []).map(
        (r: {
          _id?: unknown;
          comment?: string;
          rating?: number | null;
          subject?: string;
        }) => ({
          id: String(r._id ?? ""),
          comment: String(r.comment || "").trim(),
          rating: typeof r.rating === "number" ? r.rating : null,
          subject: String(r.subject || "unlabeled"),
        }),
      ).filter((r: { comment: string }) => r.comment),
      subjectSamples: (facet?.subjectSamples || []).map(
        (r: { _id?: unknown; count?: number; samples?: unknown[] }) => ({
          id: String(r._id || "unlabeled"),
          name:
            String(r._id || "") === "unlabeled"
              ? "(no Freshchat label)"
              : String(r._id || "Unknown"),
          count: r.count || 0,
          samples: (r.samples || [])
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .slice(0, 3),
        }),
      ),
    },
  };
}

export type KpiResult = Awaited<ReturnType<typeof getKpis>>;
