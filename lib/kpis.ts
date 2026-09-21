import { collections } from "@/lib/db/client";
import {
  KPI_DASHBOARD_PROJECT,
  KPI_VOICE_PROJECT,
} from "@/lib/conversation-stats";
import {
  buildConversationMatch,
  type ConversationFilters,
} from "@/lib/filters";
import { INSIGHT_THRESHOLDS } from "@/lib/insights/thresholds";
import { resolveSearchUserIds } from "@/lib/search";

const FRT_SLA_SECONDS = INSIGHT_THRESHOLDS.FRT_SLA_SECONDS;

const HAS_CSAT_RATING = {
  $in: [{ $type: "$csat.rating" }, ["double", "int", "long", "decimal"]],
} as const;

const HAS_RESOLUTION_LABEL = {
  $and: [
    { $eq: [{ $type: "$resolution.label" }, "string"] },
    { $ne: ["$resolution.label", ""] },
  ],
} as const;

const HAS_DERIVED_SUBJECT = {
  $and: [
    { $eq: [{ $type: "$derived.subject" }, "string"] },
    { $ne: ["$derived.subject", ""] },
    { $ne: ["$derived.subject", "unclassified"] },
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
  dissatisfied: {
    $sum: {
      $cond: [{ $and: [HAS_CSAT_RATING, { $lte: ["$csat.rating", 2] }] }, 1, 0],
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
    dissatisfied?: number;
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
      dissatisfiedRate: rated ? (r.dissatisfied || 0) / rated : null,
      csatResponseRate: conversationsCount ? rated / conversationsCount : null,
      unratedRate: conversationsCount
        ? (conversationsCount - rated) / conversationsCount
        : null,
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

function ratingBucket(n: number) {
  const bounds =
    n < 5
      ? [
          { $gte: ["$csat.rating", n] },
          { $lt: ["$csat.rating", n + 1] },
        ]
      : [{ $gte: ["$csat.rating", 5] }];
  return {
    $sum: {
      $cond: [{ $and: [HAS_CSAT_RATING, ...bounds] }, 1, 0],
    },
  };
}

function metricBucket(
  field:
    | "$metrics.first_response_time_seconds"
    | "$metrics.resolution_time_seconds",
  min: number,
  max: number | null,
) {
  const bounds =
    max == null
      ? [{ $gte: [field, min] }]
      : [{ $gte: [field, min] }, { $lt: [field, max] }];
  return {
    $sum: {
      $cond: [{ $and: [{ $ne: [field, null] }, ...bounds] }, 1, 0],
    },
  };
}

const AGG_OPTS = { allowDiskUse: true, maxTimeMS: 120_000 } as const;

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
      { $limit: 150 },
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
      { $sort: { "csat.rating": 1 as const, created_at: -1 as const } },
      { $limit: 50 },
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
        {
          $project: opts.voice ? KPI_VOICE_PROJECT : KPI_DASHBOARD_PROJECT,
        },
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
                  ratedResolvedCount: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            HAS_CSAT_RATING,
                            { $eq: ["$resolved", true] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
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
                  derivedCount: {
                    $sum: { $cond: [HAS_DERIVED_SUBJECT, 1, 0] },
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
                  frtPercentiles: {
                    $percentile: {
                      input: "$metrics.first_response_time_seconds",
                      p: [0.5, 0.9],
                      method: "approximate",
                    },
                  },
                  frtWithMetric: {
                    $sum: {
                      $cond: [
                        { $ne: ["$metrics.first_response_time_seconds", null] },
                        1,
                        0,
                      ],
                    },
                  },
                  frtOverSla: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {
                              $ne: [
                                "$metrics.first_response_time_seconds",
                                null,
                              ],
                            },
                            {
                              $gte: [
                                "$metrics.first_response_time_seconds",
                                FRT_SLA_SECONDS,
                              ],
                            },
                          ],
                        },
                        1,
                        0,
                      ],
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
                  csat1: ratingBucket(1),
                  csat2: ratingBucket(2),
                  csat3: ratingBucket(3),
                  csat4: ratingBucket(4),
                  csat5: ratingBucket(5),
                  frtLt1m: metricBucket(
                    "$metrics.first_response_time_seconds",
                    0,
                    60,
                  ),
                  frtLt2m: metricBucket(
                    "$metrics.first_response_time_seconds",
                    60,
                    FRT_SLA_SECONDS,
                  ),
                  frtLt5m: metricBucket(
                    "$metrics.first_response_time_seconds",
                    FRT_SLA_SECONDS,
                    300,
                  ),
                  frtLt15m: metricBucket(
                    "$metrics.first_response_time_seconds",
                    300,
                    900,
                  ),
                  frtLt60m: metricBucket(
                    "$metrics.first_response_time_seconds",
                    900,
                    3600,
                  ),
                  frtLt4h: metricBucket(
                    "$metrics.first_response_time_seconds",
                    3600,
                    14400,
                  ),
                  frtGt4h: metricBucket(
                    "$metrics.first_response_time_seconds",
                    14400,
                    null,
                  ),
                  resLt15m: metricBucket(
                    "$metrics.resolution_time_seconds",
                    0,
                    900,
                  ),
                  resLt60m: metricBucket(
                    "$metrics.resolution_time_seconds",
                    900,
                    3600,
                  ),
                  resLt4h: metricBucket(
                    "$metrics.resolution_time_seconds",
                    3600,
                    14400,
                  ),
                  resLt24h: metricBucket(
                    "$metrics.resolution_time_seconds",
                    14400,
                    86400,
                  ),
                  resLt3d: metricBucket(
                    "$metrics.resolution_time_seconds",
                    86400,
                    259200,
                  ),
                  resGt3d: metricBucket(
                    "$metrics.resolution_time_seconds",
                    259200,
                    null,
                  ),
                },
              },
            ],
            uniqueUsers: [
              { $group: { _id: "$primary_user_id" } },
              { $match: { _id: { $nin: [null, ""] } } },
              { $count: "n" },
            ],
            volumeCells: [
              { $match: { created_at: { $ne: null } } },
              {
                $group: {
                  _id: {
                    day: {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$created_at",
                      },
                    },
                    dow: {
                      $dayOfWeek: { date: "$created_at", timezone: tz },
                    },
                    hour: { $hour: { date: "$created_at", timezone: tz } },
                  },
                  count: { $sum: 1 },
                },
              },
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
      AGG_OPTS,
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
  const derivedCount = stats?.derivedCount || 0;
  const ratedResolvedCount = stats?.ratedResolvedCount || 0;
  const botOnlyCount = stats?.botOnlyCount || 0;
  const botInvolvedCount = stats?.botInvolvedCount || 0;
  const frtAvg =
    typeof stats?.frtAvg === "number" ? (stats.frtAvg as number) : null;
  const resAvg =
    typeof stats?.resAvg === "number" ? (stats.resAvg as number) : null;
  const frtPercentiles = Array.isArray(stats?.frtPercentiles)
    ? (stats.frtPercentiles as number[])
    : [];
  const frtMedian = frtPercentiles[0] ?? null;
  const p90FirstResponseSeconds = frtPercentiles[1] ?? null;
  const resMedian = Array.isArray(stats?.resMedian)
    ? ((stats.resMedian as number[])[0] ?? null)
    : null;
  const frtWithMetric = stats?.frtWithMetric || 0;
  const frtOverSla = stats?.frtOverSla || 0;

  const dailyResolved = facet?.dailyResolved || [];
  const resolvedByDay = new Map<string, number>(
    dailyResolved.map((d: { _id: string; resolved: number }) => [
      String(d._id),
      Number(d.resolved),
    ]),
  );
  const createdByDay = new Map<string, number>();
  const heatmapAcc = new Map<string, { weekday: number; hour: number; count: number }>();
  for (const r of (facet?.volumeCells || []) as {
    _id: { day: string; dow: number; hour: number };
    count: number;
  }[]) {
    const day = String(r._id.day);
    createdByDay.set(day, (createdByDay.get(day) || 0) + Number(r.count));
    const mongoDow = Number(r._id.dow);
    const weekday = mongoDow === 1 ? 6 : mongoDow - 2;
    const hour = Number(r._id.hour);
    const key = `${weekday}-${hour}`;
    const prev = heatmapAcc.get(key);
    heatmapAcc.set(key, {
      weekday,
      hour,
      count: (prev?.count || 0) + Number(r.count),
    });
  }
  const allDays = [
    ...new Set([...createdByDay.keys(), ...resolvedByDay.keys()]),
  ].sort();
  const dailyVolumeMerged = allDays.map((date) => ({
    date,
    count: Number(createdByDay.get(date) || 0),
    resolved: Number(resolvedByDay.get(date) || 0),
  }));
  const heatmapCells = [...heatmapAcc.values()];

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
  const csatDistribution = [
    { rating: 1, count: Number(stats?.csat1 || 0) },
    { rating: 2, count: Number(stats?.csat2 || 0) },
    { rating: 3, count: Number(stats?.csat3 || 0) },
    { rating: 4, count: Number(stats?.csat4 || 0) },
    { rating: 5, count: Number(stats?.csat5 || 0) },
  ];
  const averageCsatByAgent = [...agentDeep]
    .filter((a) => a.rated > 0 && a.avgCsat != null)
    .sort((a, b) => (b.avgCsat || 0) - (a.avgCsat || 0))
    .slice(0, 15);
  const csatByChannelRaw = [...channelDeep]
    .filter((c) => c.rated > 0 && c.avgCsat != null)
    .sort((a, b) => b.rated - a.rated)
    .slice(0, 10);

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
      ratedResolvedCount,
      csatResponseRate: total ? ratedCount / total : null,
      csatResponseRateResolved: resolvedCount
        ? ratedResolvedCount / resolvedCount
        : null,
      satisfiedRate: ratedCount ? stats.satisfiedCount / ratedCount : null,
      dissatisfiedRate: ratedCount ? dissatisfiedCount / ratedCount : null,
      dissatisfiedCount,
      labelCoverage: total ? labeledCount / total : null,
      unlabeledCount,
      derivedCoverage: total ? derivedCount / total : null,
      derivedCount,
      avgMessages: total ? (stats?.messageSum || 0) / total : null,
      avgFirstResponseSeconds: frtAvg,
      medianFirstResponseSeconds: frtMedian,
      p90FirstResponseSeconds,
      frtOverSlaCount: frtOverSla,
      frtOverSlaRate: frtWithMetric ? frtOverSla / frtWithMetric : null,
      frtWithMetricCount: frtWithMetric,
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
      csatDistribution,
      bySubject: subjectDeep.slice(0, 15).map((s) => ({
        subject: s.id,
        label: s.name,
        count: s.conversations,
      })),
      byChannel: channelDeep.slice(0, 10).map((c) => ({
        channel: c.name,
        count: c.conversations,
      })),
      averageCsatByAgent: averageCsatByAgent.map((a) => ({
        agentId: a.id,
        agentName: a.name,
        average: Number(a.avgCsat?.toFixed?.(2) ?? a.avgCsat),
        ratedCount: a.rated,
      })),
      agentVolume: agentDeep.slice(0, 15).map((a) => ({
        agentId: a.id,
        agentName: a.name,
        count: a.conversations,
      })),
      volumeHeatmap: heatmapCells,
      frtDistribution: [
        { bucket: "<1m", count: Number(stats?.frtLt1m || 0) },
        { bucket: "1–2m", count: Number(stats?.frtLt2m || 0) },
        { bucket: "2–5m", count: Number(stats?.frtLt5m || 0) },
        { bucket: "5–15m", count: Number(stats?.frtLt15m || 0) },
        { bucket: "15–60m", count: Number(stats?.frtLt60m || 0) },
        { bucket: "1–4h", count: Number(stats?.frtLt4h || 0) },
        { bucket: ">4h", count: Number(stats?.frtGt4h || 0) },
      ],
      resolutionDistribution: [
        { bucket: "<15m", count: Number(stats?.resLt15m || 0) },
        { bucket: "15–60m", count: Number(stats?.resLt60m || 0) },
        { bucket: "1–4h", count: Number(stats?.resLt4h || 0) },
        { bucket: "4–24h", count: Number(stats?.resLt24h || 0) },
        { bucket: "1–3d", count: Number(stats?.resLt3d || 0) },
        { bucket: ">3d", count: Number(stats?.resGt3d || 0) },
      ],
      actorShare,
      resolvedMix: [
        { status: "Resolved", count: resolvedCount },
        { status: "Open", count: openCount },
      ].filter((r) => r.count > 0),
      csatByChannel: csatByChannelRaw.map((c) => ({
        channel: c.name,
        average: Number(c.avgCsat?.toFixed?.(2) ?? c.avgCsat),
        ratedCount: c.rated,
      })),
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

export type DissatisfiedBoardRow = {
  id: string;
  rating: number | null;
  comment: string | null;
  preview: string;
  subject: string;
  channel: string | null;
  agent: string | null;
  frtSeconds: number | null;
  resolved: boolean;
};

export async function getDissatisfiedBoard(
  filters: ConversationFilters,
  limit = 50,
): Promise<DissatisfiedBoardRow[]> {
  const { conversations } = await collections();
  const match = await matchFor(filters);
  const clauses = match.$and
    ? [...(match.$and as object[])]
    : Object.keys(match).length
      ? [match]
      : [];
  clauses.push({
    "csat.rating": { $ne: null, $lte: 2 },
  });
  const docs = await conversations
    .find(clauses.length === 1 ? clauses[0] : { $and: clauses }, {
      projection: {
        "csat.rating": 1,
        "csat.comment": 1,
        preview_text: 1,
        "derived.subject": 1,
        "resolution.label": 1,
        channel_name: 1,
        assigned_agent_name: 1,
        "metrics.first_response_time_seconds": 1,
        resolved: 1,
      },
    })
    .sort({ "csat.rating": 1, created_at: -1 })
    .limit(limit)
    .toArray();

  return docs.map((c) => {
    const subject =
      (typeof c.derived?.subject === "string" && c.derived.subject) ||
      (typeof c.resolution?.label === "string" && c.resolution.label) ||
      "";
    return {
      id: String(c._id),
      rating: typeof c.csat?.rating === "number" ? c.csat.rating : null,
      comment: c.csat?.comment?.trim() || null,
      preview: (c.preview_text || "").trim(),
      subject: subject || "(no Freshchat label)",
      channel: c.channel_name || null,
      agent: c.assigned_agent_name || null,
      frtSeconds:
        typeof c.metrics?.first_response_time_seconds === "number"
          ? c.metrics.first_response_time_seconds
          : null,
      resolved: c.resolved === true,
    };
  });
}

export type KpiResult = Awaited<ReturnType<typeof getKpis>>;
