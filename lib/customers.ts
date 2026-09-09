import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import type { EmbeddedAttachment } from "@/lib/db/types";
import { parseChannel } from "@/lib/display/channel";
import {
  buildConversationMatch,
  customerMongoSort,
  type ConversationFilters,
} from "@/lib/filters";

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u._id;
}

export async function listCustomers(
  opts: ConversationFilters & { q?: string },
) {
  const { users, conversations } = await collections();
  const limit = opts.limit;
  const skip = (opts.page - 1) * limit;
  const q = (opts.q || "").trim();

  // Conversations matching the same filters as dashboard / conversations
  const convMatch = buildConversationMatch({
    ...opts,
    // When searching by free text, don't require userIds from multi-select only
    q: undefined,
  });

  const matchedUsers = await conversations
    .aggregate<{ _id: string }>([
      { $match: convMatch },
      {
        $project: {
          ids: {
            $setUnion: [
              { $cond: [{ $ne: ["$primary_user_id", null] }, ["$primary_user_id"], []] },
              { $ifNull: ["$user_ids", []] },
            ],
          },
        },
      },
      { $unwind: "$ids" },
      { $match: { ids: { $nin: [null, ""] } } },
      { $group: { _id: "$ids" } },
    ])
    .toArray();

  let candidateIds = matchedUsers.map((r) => r._id);

  // Free-text also finds users by profile fields, then intersect with candidates
  // (or union if channel/phone typed — include users found via channel name match)
  if (q) {
    const re = {
      $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    const textHits = await users
      .find({
        role: "user",
        $or: [
          { _id: q },
          { first_name: re },
          { last_name: re },
          { email: re },
          { phone: re },
          { reference_id: re },
        ],
      })
      .project({ _id: 1 })
      .limit(500)
      .toArray();
    const textIds = new Set(textHits.map((u) => u._id));

    // Also match channel / handle / agent / label in conversations
    const channelHits = await conversations
      .aggregate<{ _id: string }>([
        {
          $match: {
            ...convMatch,
            $or: [
              { channel_name: re },
              { assigned_agent_name: re },
              { group_name: re },
              { "resolution.label": re },
              { "derived.subject": re },
            ],
          },
        },
        {
          $project: {
            ids: {
              $setUnion: [
                {
                  $cond: [
                    { $ne: ["$primary_user_id", null] },
                    ["$primary_user_id"],
                    [],
                  ],
                },
                { $ifNull: ["$user_ids", []] },
              ],
            },
          },
        },
        { $unwind: "$ids" },
        { $group: { _id: "$ids" } },
      ])
      .toArray();
    for (const h of channelHits) textIds.add(h._id);

    candidateIds = candidateIds.filter((id) => textIds.has(id));
  }

  const totalItems = candidateIds.length;
  if (totalItems === 0) {
    return {
      items: [],
      totalItems: 0,
      page: opts.page,
      limit,
      totalPages: 1,
    };
  }

  const mongoSort = customerMongoSort(opts);
  const needsComputedSort =
    opts.sort === "conversation_count" || opts.sort === "customer_messages";

  // For computed sorts, load all matching users + counts then sort/slice in memory
  const fetchLimit = needsComputedSort ? candidateIds.length : limit;
  const fetchSkip = needsComputedSort ? 0 : skip;

  const rows = await users
    .find({ role: "user", _id: { $in: candidateIds } })
    .sort(mongoSort || { "stats.last_seen_at": -1 })
    .skip(fetchSkip)
    .limit(fetchLimit)
    .toArray();

  const ids = rows.map((u) => u._id);

  const counts =
    ids.length === 0
      ? []
      : await conversations
          .aggregate([
            {
              $match: {
                ...convMatch,
                $or: [
                  { primary_user_id: { $in: ids } },
                  { user_ids: { $in: ids } },
                ],
              },
            },
            {
              $addFields: {
                _uid: {
                  $ifNull: [
                    "$primary_user_id",
                    { $arrayElemAt: ["$user_ids", 0] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$_uid",
                conversationCount: { $addToSet: "$_id" },
                messageSum: { $sum: "$message_count" },
                lastChannel: { $last: "$channel_name" },
                lastAgent: { $last: "$assigned_agent_name" },
                lastAgentId: { $last: "$assigned_agent_id" },
              },
            },
            {
              $project: {
                conversationCount: { $size: "$conversationCount" },
                messageSum: 1,
                lastChannel: 1,
                lastAgent: 1,
                lastAgentId: 1,
              },
            },
          ])
          .toArray();

  const countMap = new Map(counts.map((c) => [c._id as string, c]));

  let items = rows.map((u) => {
    const c = countMap.get(u._id);
    const ch = parseChannel((c?.lastChannel as string) || null);
    return {
      id: u._id,
      name: displayName(u),
      email: u.email,
      phone: u.phone,
      referenceId: u.reference_id,
      enrichmentStatus: u.enrichment?.status ?? null,
      firstSeenAt: u.stats?.first_seen_at ?? null,
      lastSeenAt: u.stats?.last_seen_at ?? null,
      conversationCount:
        c?.conversationCount ?? u.stats?.conversation_count ?? 0,
      messageCount: c?.messageSum ?? 0,
      lastChannel: c?.lastChannel ?? null,
      lastChannelKind: ch.label,
      lastChannelIdentity: ch.identity,
      lastAgent: c?.lastAgent ?? null,
      lastAgentId: (c?.lastAgentId as string) || null,
      raw: {
        id: u._id,
        email: u.email,
        phone: u.phone,
        reference_id: u.reference_id,
        properties: u.properties,
        stats: u.stats,
      },
    };
  });

  if (needsComputedSort) {
    const dir = opts.order === "asc" ? 1 : -1;
    items.sort((a, b) => {
      const av =
        opts.sort === "customer_messages"
          ? a.messageCount
          : a.conversationCount;
      const bv =
        opts.sort === "customer_messages"
          ? b.messageCount
          : b.conversationCount;
      return (av - bv) * dir;
    });
    items = items.slice(skip, skip + limit);
  }

  return {
    items,
    totalItems,
    page: opts.page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  };
}

export async function getCustomer(id: string) {
  const { users, conversations } = await collections();
  const u = await users.findOne({ _id: id });
  if (!u) return null;

  const convos = await conversations
    .find({
      $or: [{ primary_user_id: id }, { user_ids: id }],
    })
    .sort({ created_at: -1 })
    .limit(100)
    .project({
      channel_name: 1,
      channel_id: 1,
      created_at: 1,
      resolved_at: 1,
      resolved: 1,
      assigned_agent_id: 1,
      assigned_agent_name: 1,
      message_count: 1,
      "csat.rating": 1,
      "resolution.label": 1,
      status: 1,
      conversation_url: 1,
    })
    .toArray();

  return {
    id: u._id,
    name: displayName(u),
    email: u.email,
    phone: u.phone,
    referenceId: u.reference_id,
    role: u.role,
    firstName: u.first_name,
    lastName: u.last_name,
    properties: u.properties || {},
    enrichment: u.enrichment,
    stats: u.stats,
    conversations: convos.map((c) => ({
      id: c._id,
      channel: c.channel_name,
      channelId: c.channel_id,
      createdAt: c.created_at,
      resolvedAt: c.resolved_at,
      resolved: c.resolved,
      agentId: c.assigned_agent_id,
      agentName: c.assigned_agent_name,
      messageCount: c.message_count,
      csat: c.csat?.rating ?? null,
      label: c.resolution?.label ?? null,
      status: c.status,
      url: c.conversation_url,
    })),
    raw: u,
  };
}

export interface ChatMessageRow {
  messageId: string;
  conversationId: string;
  createdAt: Date;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  text: string;
  hasAttachment: boolean;
  attachments: EmbeddedAttachment[];
  channelName: string | null;
  channelId: string | null;
  messageSource: string | null;
  raw: Record<string, string> | null;
}

/** Newest-first page for WhatsApp-style scroll-up history. */
export async function listCustomerMessages(opts: {
  userId: string;
  from?: string;
  to?: string;
  before?: string; // ISO timestamp cursor
  limit?: number;
}): Promise<{ items: ChatMessageRow[]; hasMore: boolean }> {
  const { conversations } = await collections();
  const limit = Math.min(
    opts.limit ?? getConfig().CUSTOMER_CHAT_PAGE_SIZE,
    100,
  );

  const match: Record<string, unknown> = {
    $or: [
      { primary_user_id: opts.userId },
      { user_ids: opts.userId },
    ],
  };
  if (opts.from || opts.to) {
    const range: Record<string, Date> = {};
    if (opts.from) range.$gte = new Date(`${opts.from}T00:00:00.000Z`);
    if (opts.to) {
      const end = new Date(`${opts.to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      range.$lt = end;
    }
    match.created_at = range;
  }

  const msgMatch: Record<string, unknown> = {};
  if (opts.before) {
    msgMatch["messages.created_at"] = { $lt: new Date(opts.before) };
  }

  const rows = await conversations
    .aggregate([
      { $match: match },
      { $unwind: "$messages" },
      ...(opts.before
        ? [{ $match: { "messages.created_at": { $lt: new Date(opts.before) } } }]
        : []),
      { $sort: { "messages.created_at": -1, "messages.message_id": -1 } },
      { $limit: limit + 1 },
      {
        $project: {
          conversationId: "$_id",
          channelName: "$channel_name",
          channelId: "$channel_id",
          message: "$messages",
        },
      },
    ])
    .toArray();

  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);

  const items: ChatMessageRow[] = slice.map((r) => {
    const m = r.message as {
      message_id: string;
      created_at: Date;
      actor_type: string;
      actor_id: string | null;
      actor_email?: string | null;
      actor_first_name?: string | null;
      actor_last_name?: string | null;
      text: string;
      has_attachment: boolean;
      attachments?: EmbeddedAttachment[];
      message_source?: string | null;
      raw?: Record<string, string>;
    };
    const actorName = [m.actor_first_name, m.actor_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      messageId: m.message_id,
      conversationId: r.conversationId as string,
      createdAt: m.created_at,
      actorType: m.actor_type,
      actorId: m.actor_id,
      actorName: actorName || null,
      actorEmail: m.actor_email || null,
      text: m.text,
      hasAttachment: m.has_attachment,
      attachments: m.attachments || [],
      channelName: (r.channelName as string) || null,
      channelId: (r.channelId as string) || null,
      messageSource: m.message_source || null,
      raw: m.raw || null,
    };
  });

  return { items, hasMore };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  // Excel-friendly UTF-8 BOM
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Exact CSV of all customers matching filters (no row cap). */
export async function exportCustomersCsv(
  opts: ConversationFilters & { q?: string },
) {
  const { users, conversations } = await collections();
  const q = (opts.q || "").trim();
  const convMatch = buildConversationMatch({ ...opts, q: undefined });

  const matchedUsers = await conversations
    .aggregate<{ _id: string }>([
      { $match: convMatch },
      {
        $project: {
          ids: {
            $setUnion: [
              {
                $cond: [
                  { $ne: ["$primary_user_id", null] },
                  ["$primary_user_id"],
                  [],
                ],
              },
              { $ifNull: ["$user_ids", []] },
            ],
          },
        },
      },
      { $unwind: "$ids" },
      { $match: { ids: { $nin: [null, ""] } } },
      { $group: { _id: "$ids" } },
    ])
    .toArray();

  let candidateIds = matchedUsers.map((r) => r._id);

  if (q) {
    const re = {
      $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    const textHits = await users
      .find({
        role: "user",
        $or: [
          { _id: q },
          { first_name: re },
          { last_name: re },
          { email: re },
          { phone: re },
          { reference_id: re },
        ],
      })
      .project({ _id: 1 })
      .toArray();
    const textIds = new Set(textHits.map((u) => u._id));
    const channelHits = await conversations
      .aggregate<{ _id: string }>([
        {
          $match: {
            ...convMatch,
            $or: [
              { channel_name: re },
              { assigned_agent_name: re },
              { group_name: re },
              { "resolution.label": re },
              { "derived.subject": re },
            ],
          },
        },
        {
          $project: {
            ids: {
              $setUnion: [
                {
                  $cond: [
                    { $ne: ["$primary_user_id", null] },
                    ["$primary_user_id"],
                    [],
                  ],
                },
                { $ifNull: ["$user_ids", []] },
              ],
            },
          },
        },
        { $unwind: "$ids" },
        { $group: { _id: "$ids" } },
      ])
      .toArray();
    for (const h of channelHits) textIds.add(h._id);
    candidateIds = candidateIds.filter((id) => textIds.has(id));
  }

  const rows = await users
    .find({ role: "user", _id: { $in: candidateIds } })
    .sort({ "stats.last_seen_at": -1 })
    .toArray();

  const ids = rows.map((u) => u._id);
  const counts =
    ids.length === 0
      ? []
      : await conversations
          .aggregate([
            {
              $match: {
                ...convMatch,
                $or: [
                  { primary_user_id: { $in: ids } },
                  { user_ids: { $in: ids } },
                ],
              },
            },
            {
              $addFields: {
                _uid: {
                  $ifNull: [
                    "$primary_user_id",
                    { $arrayElemAt: ["$user_ids", 0] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$_uid",
                conversationCount: { $sum: 1 },
                messageSum: { $sum: "$message_count" },
                lastChannel: { $last: "$channel_name" },
                lastAgent: { $last: "$assigned_agent_name" },
                lastAgentId: { $last: "$assigned_agent_id" },
              },
            },
          ])
          .toArray();
  const countMap = new Map(counts.map((c) => [c._id as string, c]));

  const headers = [
    "user_id",
    "name",
    "email",
    "phone",
    "reference_id",
    "channel",
    "channel_kind",
    "channel_identity",
    "responder",
    "responder_id",
    "conversation_count",
    "message_count",
    "first_seen_at",
    "last_seen_at",
    "enrichment_status",
  ];

  const data = rows.map((u) => {
    const c = countMap.get(u._id);
    const ch = parseChannel((c?.lastChannel as string) || null);
    return [
      u._id,
      displayName(u),
      u.email,
      u.phone,
      u.reference_id,
      c?.lastChannel ?? "",
      ch.label,
      ch.identity,
      c?.lastAgent ?? "",
      c?.lastAgentId ?? "",
      c?.conversationCount ?? u.stats?.conversation_count ?? 0,
      c?.messageSum ?? 0,
      u.stats?.first_seen_at?.toISOString?.() || "",
      u.stats?.last_seen_at?.toISOString?.() || "",
      u.enrichment?.status ?? "",
    ];
  });

  return {
    csv: toCsv(headers, data),
    exported: data.length,
    totalMatched: data.length,
    truncated: false,
  };
}

/** Exact CSV of one customer's messages (chat transcript). */
export async function exportCustomerChatCsv(opts: {
  userId: string;
  from?: string;
  to?: string;
}) {
  const { conversations, users } = await collections();
  const u = await users.findOne({ _id: opts.userId });
  const match: Record<string, unknown> = {
    $or: [
      { primary_user_id: opts.userId },
      { user_ids: opts.userId },
    ],
  };
  if (opts.from || opts.to) {
    const range: Record<string, Date> = {};
    if (opts.from) range.$gte = new Date(`${opts.from}T00:00:00.000Z`);
    if (opts.to) {
      const end = new Date(`${opts.to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      range.$lt = end;
    }
    match.created_at = range;
  }

  const rows = await conversations
    .aggregate([
      { $match: match },
      { $unwind: "$messages" },
      { $sort: { "messages.created_at": 1, "messages.message_id": 1 } },
      {
        $project: {
          conversationId: "$_id",
          channelName: "$channel_name",
          channelId: "$channel_id",
          assignedAgentId: "$assigned_agent_id",
          assignedAgentName: "$assigned_agent_name",
          message: "$messages",
        },
      },
    ])
    .toArray();

  const headers = [
    "user_id",
    "user_name",
    "user_email",
    "user_phone",
    "conversation_id",
    "channel_id",
    "channel",
    "assigned_agent_id",
    "assigned_agent_name",
    "message_id",
    "created_at",
    "actor_type",
    "actor_id",
    "actor_name",
    "actor_email",
    "message_source",
    "text",
    "has_attachment",
    "attachment_count",
    "attachment_names",
    "attachment_urls",
  ];

  const userName = u ? displayName(u) : opts.userId;
  const data = rows.map((r) => {
    const m = r.message as {
      message_id: string;
      created_at: Date;
      actor_type: string;
      actor_id: string | null;
      actor_email?: string | null;
      actor_first_name?: string | null;
      actor_last_name?: string | null;
      text: string;
      has_attachment: boolean;
      message_source?: string | null;
      attachments?: { file_name?: string | null; url?: string | null }[];
    };
    const actorName = [m.actor_first_name, m.actor_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const atts = m.attachments || [];
    return [
      opts.userId,
      userName,
      u?.email ?? "",
      u?.phone ?? "",
      r.conversationId,
      r.channelId,
      r.channelName,
      r.assignedAgentId,
      r.assignedAgentName,
      m.message_id,
      m.created_at?.toISOString?.() || "",
      m.actor_type,
      m.actor_id,
      actorName,
      m.actor_email,
      m.message_source,
      m.text,
      m.has_attachment,
      atts.length,
      atts.map((a) => a.file_name || "").join("|"),
      atts.map((a) => a.url || "").join("|"),
    ];
  });

  return {
    csv: toCsv(headers, data),
    exported: data.length,
    totalMatched: data.length,
    truncated: false,
  };
}

