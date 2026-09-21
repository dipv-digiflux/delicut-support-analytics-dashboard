import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import {
  buildConversationMatch,
  sortSpec,
  type ConversationFilters,
} from "@/lib/filters";
import { resolveSearchUserIds } from "@/lib/search";
import {
  campaignPct,
  getLatestActiveCampaign,
  getLatestCampaign,
} from "@/lib/sync/campaign";
import { remainingQuota } from "@/lib/freshchat/budget";
import { LIST_PROJECT } from "@/lib/conversation-stats";
import {
  collectRawColumnKeys,
  mapChatMessage,
  messageExportHeaders,
  messageExportRow,
  toCsv,
} from "@/lib/export-messages";
import type { EmbeddedMessage } from "@/lib/db/types";
import { lookupPlatformCustomer } from "@/lib/platform/lookup";

export { getKpis, getDissatisfiedBoard } from "@/lib/kpis";

async function matchFor(filters: ConversationFilters) {
  const searchUserIds = filters.q?.trim()
    ? await resolveSearchUserIds(filters.q)
    : [];
  return buildConversationMatch(filters, searchUserIds);
}

export async function listConversations(filters: ConversationFilters) {
  const { conversations, users } = await collections();
  const match = await matchFor(filters);
  const [totalItems, items] = await Promise.all([
    conversations.countDocuments(match),
    conversations
      .find(match, { projection: LIST_PROJECT })
      .sort(sortSpec(filters))
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .toArray(),
  ]);

  const userIds = [
    ...new Set(items.map((i) => i.primary_user_id).filter(Boolean)),
  ] as string[];
  const userDocs = userIds.length
    ? await users
        .find(
          { _id: { $in: userIds } },
          {
            projection: {
              first_name: 1,
              last_name: 1,
              email: 1,
              phone: 1,
            },
          },
        )
        .toArray()
    : [];
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
        responders: (c.agent_ids || []).map((id) => ({ id })),
        status: c.status,
        resolved: c.resolved,
        reopened: c.reopened,
        csat: c.csat?.rating ?? null,
        csatComment: c.csat?.comment || null,
        messageCount: c.message_count,
        attachmentCount: c.attachment_count ?? 0,
        lastMessageAt: c.last_message_at,
        firstResponseSeconds: c.metrics?.first_response_time_seconds ?? null,
        resolutionSeconds: c.metrics?.resolution_time_seconds ?? null,
        preview: c.preview_text || "",
        conversationUrl: c.conversation_url,
        isStub: c.is_stub,
      };
    }),
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / filters.limit)),
  };
}

export async function getConversation(
  id: string,
  opts?: { includeMessages?: boolean },
) {
  const { conversations, users } = await collections();
  const c = await conversations.findOne(
    { _id: id },
    opts?.includeMessages ? undefined : { projection: { messages: 0 } },
  );
  if (!c) return null;

  const u = c.primary_user_id
    ? await users.findOne(
        { _id: c.primary_user_id },
        {
          projection: {
            first_name: 1,
            last_name: 1,
            email: 1,
            phone: 1,
            reference_id: 1,
            properties: 1,
          },
        },
      )
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
      referenceId: u?.reference_id || null,
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
    messageCount: c.message_count,
    messagesTruncated: c.messages_truncated,
    messages: [],
    platform: await lookupPlatformCustomer({
      phone: u?.phone,
      email: u?.email,
      referenceId: u?.reference_id,
    }),
    raw: c,
  };
}

/** Newest-first page of messages for one conversation (infinite scroll). */
export async function listConversationMessages(opts: {
  conversationId: string;
  before?: string;
  limit?: number;
}) {
  const { conversations } = await collections();
  const limit = Math.min(opts.limit ?? 40, 100);

  const rows = await conversations
    .aggregate([
      { $match: { _id: opts.conversationId } },
      { $unwind: "$messages" },
      ...(opts.before
        ? [
            {
              $match: {
                "messages.created_at": { $lt: new Date(opts.before) },
              },
            },
          ]
        : []),
      { $sort: { "messages.created_at": -1, "messages.message_id": -1 } },
      { $limit: limit + 1 },
      {
        $project: {
          channelName: "$channel_name",
          channelId: "$channel_id",
          message: "$messages",
        },
      },
    ])
    .toArray();

  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);

  const items = slice.map((r) =>
    mapChatMessage(r.message as EmbeddedMessage, {
      conversationId: opts.conversationId,
      channelName: (r.channelName as string) || null,
      channelId: (r.channelId as string) || null,
    }),
  );

  return { items, hasMore };
}

export async function exportConversationsCsv(filters: ConversationFilters) {
  const { conversations, users } = await collections();
  const match = await matchFor({ ...filters, page: 1, limit: 25 });
  const EXPORT_CAP = getConfig().EXPORT_CSV_MAX_ROWS;
  const totalMatched = await conversations.countDocuments(match);
  const items = await conversations
    .find(match, {
      projection: {
        messages: 0,
      },
    })
    .sort(sortSpec(filters))
    .limit(EXPORT_CAP)
    .toArray();
  const truncated = totalMatched > items.length;

  const userIds = [
    ...new Set(items.map((i) => i.primary_user_id).filter(Boolean)),
  ] as string[];
  const userDocs = await users
    .find(
      { _id: { $in: userIds } },
      { projection: { first_name: 1, last_name: 1, email: 1, phone: 1 } },
    )
    .toArray();
  const userMap = new Map(userDocs.map((u) => [u._id, u]));

  const headers = [
    "conversation_id",
    "created_at",
    "last_message_at",
    "resolved_at",
    "resolved",
    "reopened",
    "status",
    "channel_id",
    "channel",
    "group_id",
    "group",
    "user_id",
    "user_ids",
    "user_name",
    "user_email",
    "user_phone",
    "agent_id",
    "agent_name",
    "responder_ids",
    "resolution_label",
    "resolution_sub_label",
    "csat_rating",
    "csat_rating_raw",
    "csat_comment",
    "csat_submitted_at",
    "message_count",
    "messages_truncated",
    "has_attachment",
    "attachment_count",
    "actor_user",
    "actor_agent",
    "actor_bot",
    "actor_system",
    "first_response_seconds",
    "resolution_seconds",
    "response_time_seconds",
    "conversation_url",
    "preview",
    "is_stub",
  ];

  const rows: unknown[][] = [];
  for (const c of items) {
    const u = c.primary_user_id ? userMap.get(c.primary_user_id) : null;
    const name = u
      ? [u.first_name, u.last_name].filter(Boolean).join(" ")
      : "";
    rows.push([
      c._id,
      c.created_at?.toISOString?.() || "",
      c.last_message_at?.toISOString?.() || "",
      c.resolved_at?.toISOString?.() || "",
      c.resolved,
      c.reopened,
      c.status,
      c.channel_id,
      c.channel_name,
      c.group_id,
      c.group_name,
      c.primary_user_id,
      (c.user_ids || []).join("|"),
      name,
      u?.email,
      u?.phone,
      c.assigned_agent_id,
      c.assigned_agent_name,
      (c.agent_ids || []).join("|"),
      c.resolution?.label,
      c.resolution?.sub_label,
      c.csat?.rating,
      c.csat?.rating_raw,
      c.csat?.comment,
      c.csat?.submitted_at?.toISOString?.() || "",
      c.message_count,
      c.messages_truncated,
      c.has_attachment,
      c.attachment_count ?? 0,
      c.actor_counts?.user ?? 0,
      c.actor_counts?.agent ?? 0,
      c.actor_counts?.bot ?? 0,
      c.actor_counts?.system ?? 0,
      c.metrics?.first_response_time_seconds,
      c.metrics?.resolution_time_seconds,
      c.metrics?.response_time_seconds,
      c.conversation_url,
      c.preview_text || "",
      c.is_stub,
    ]);
  }

  return {
    csv: toCsv(headers, rows),
    exported: items.length,
    totalMatched,
    truncated,
    cap: EXPORT_CAP,
  };
}

/** One CSV row per message, including every Freshchat CSV column from `messages.raw`. */
export async function exportMessagesCsv(
  filters: ConversationFilters,
  opts?: { conversationId?: string },
) {
  const { conversations } = await collections();
  const match = opts?.conversationId
    ? { _id: opts.conversationId }
    : await matchFor({ ...filters, page: 1, limit: 25 });
  const EXPORT_CAP = getConfig().EXPORT_CSV_MAX_ROWS;
  const convos = await conversations
    .find(match)
    .sort(opts?.conversationId ? { _id: 1 } : sortSpec(filters))
    .limit(opts?.conversationId ? 1 : EXPORT_CAP)
    .toArray();

  const convMatched = opts?.conversationId
    ? convos.length
    : await conversations.countDocuments(match);
  const truncated = !opts?.conversationId && convMatched > convos.length;

  const allMessages = convos.flatMap((c) => c.messages || []);
  const rawKeys = collectRawColumnKeys(allMessages);
  const headers = messageExportHeaders(rawKeys);

  const rows: unknown[][] = [];
  let messageRows = 0;
  for (const c of convos) {
    for (const m of c.messages || []) {
      rows.push(messageExportRow(c, m, rawKeys));
      messageRows++;
    }
  }

  return {
    csv: toCsv(headers, rows),
    exported: messageRows,
    totalMatched: messageRows,
    truncated,
    cap: EXPORT_CAP,
    conversations: convos.length,
  };
}

export async function getSyncStatus() {
  const { syncRuns, conversations } = await collections();
  const cfg = getConfig();
  const [latest, count, convBounds] = await Promise.all([
    syncRuns.find({}).sort({ started_at: -1 }).limit(1).next(),
    conversations.estimatedDocumentCount(),
    conversations
      .aggregate<{ min: Date | null; max: Date | null }>([
        {
          $group: {
            _id: null,
            min: { $min: "$created_at" },
            max: { $max: "$created_at" },
          },
        },
        { $project: { _id: 0, min: 1, max: 1 } },
      ])
      .next(),
  ]);
  const warehouse = {
    from: convBounds?.min ?? null,
    to: convBounds?.max ?? null,
    conversations: count,
  };
  const active =
    (await getLatestActiveCampaign()) || (await getLatestCampaign());
  const transcriptQuotaLeft = await remainingQuota("Chat-Transcript");

  const campaign = active
    ? {
        id: active._id,
        status: active.status,
        pct: campaignPct(active.stats),
        merged: active.stats.merged,
        total: active.stats.total,
        pending: active.stats.pending,
        failed: active.stats.failed,
        order: active.order,
        since: active.since,
        until: active.until,
        checkpoint: active.checkpoint ?? null,
        quotaStopped: active.quota_stopped,
      }
    : null;

  const quota = {
    event: "Chat-Transcript" as const,
    remaining: transcriptQuotaLeft,
    maxPerDay: cfg.EXTRACT_MAX_JOBS_PER_DAY,
  };

  if (!latest) {
    return {
      state: "never_run" as const,
      lastStartedAt: null,
      lastCompletedAt: null,
      conversationsProcessed: count,
      failedRecords: 0,
      counters: null,
      campaign,
      quota,
      warehouse,
    };
  }

  let state:
    | "never_run"
    | "running"
    | "failed"
    | "partial"
    | "idle"
    | "paused_quota" =
    latest.status === "running"
      ? "running"
      : latest.status === "failed"
        ? "failed"
        : latest.status === "partial"
          ? "partial"
          : "idle";

  if (state !== "running" && campaign?.status === "paused_quota") {
    state = "paused_quota";
  }

  return {
    state,
    lastStartedAt: latest.started_at,
    lastCompletedAt: latest.finished_at,
    conversationsProcessed: count,
    failedRecords: latest.counters.windows_failed + latest.errors.length,
    counters: latest.counters,
    campaign,
    quota,
    warehouse,
  };
}
