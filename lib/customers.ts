import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import type { EmbeddedMessage } from "@/lib/db/types";
import { parseChannel } from "@/lib/display/channel";
import {
  buildConversationMatch,
  customerMongoSort,
  type ConversationFilters,
} from "@/lib/filters";
import {
  collectRawColumnKeys,
  mapChatMessage,
  messageExportHeaders,
  messageExportRow,
  toCsv,
} from "@/lib/export-messages";
import { lookupPlatformCustomer } from "@/lib/platform/lookup";

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u._id;
}

const AGG_OPTS = { allowDiskUse: true, maxTimeMS: 120_000 } as const;

function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueCustomerPipeline(convMatch: Record<string, unknown>) {
  return [
    { $match: convMatch },
    {
      $project: {
        uid: "$primary_user_id",
        created_at: 1,
        message_count: 1,
        channel_name: 1,
        assigned_agent_name: 1,
        assigned_agent_id: 1,
      },
    },
    { $match: { uid: { $nin: [null, ""] } } },
    {
      $group: {
        _id: "$uid",
        lastAt: { $max: "$created_at" },
        conversationCount: { $sum: 1 },
        messageSum: { $sum: { $ifNull: ["$message_count", 0] } },
        lastChannel: { $last: "$channel_name" },
        lastAgent: { $last: "$assigned_agent_name" },
        lastAgentId: { $last: "$assigned_agent_id" },
      },
    },
  ];
}

async function conversationMatchForCustomers(
  opts: ConversationFilters & { q?: string },
) {
  const { users } = await collections();
  const convMatch = buildConversationMatch({ ...opts, q: undefined }) as Record<
    string,
    unknown
  >;
  const q = (opts.q || "").trim();
  if (!q) return convMatch;

  const re = { $regex: escapeRegex(q), $options: "i" };
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
  const textIds = textHits.map((u) => u._id);

  return {
    $and: [
      convMatch,
      {
        $or: [
          ...(textIds.length
            ? [
                { primary_user_id: { $in: textIds } },
                { user_ids: { $in: textIds } },
              ]
            : []),
          { channel_name: re },
          { assigned_agent_name: re },
          { group_name: re },
          { "resolution.label": re },
          { "derived.subject": re },
        ],
      },
    ],
  };
}

function userLookupStage() {
  return {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      pipeline: [
        { $match: { role: "user" } },
        {
          $project: {
            first_name: 1,
            last_name: 1,
            email: 1,
            phone: 1,
            reference_id: 1,
            enrichment: 1,
            stats: 1,
            properties: 1,
            role: 1,
          },
        },
      ],
      as: "u",
    },
  };
}

function groupedSort(opts: ConversationFilters): Record<string, 1 | -1> {
  const dir = opts.order === "asc" ? 1 : -1;
  if (opts.sort === "conversation_count") return { conversationCount: dir };
  if (opts.sort === "customer_messages") return { messageSum: dir };
  return { lastAt: dir };
}

export async function listCustomers(
  opts: ConversationFilters & { q?: string },
) {
  const { conversations } = await collections();
  const limit = opts.limit;
  const skip = (opts.page - 1) * limit;
  const convMatch = await conversationMatchForCustomers(opts);
  const profileSort = customerMongoSort(opts);
  const needsUserSort =
    Boolean(profileSort) && opts.sort !== "last_seen_at";

  const pagePipeline = needsUserSort
    ? [
        userLookupStage(),
        { $unwind: "$u" },
        { $sort: Object.fromEntries(
          Object.entries(profileSort!).map(([k, v]) => [`u.${k}`, v]),
        ) },
        { $skip: skip },
        { $limit: limit },
      ]
    : [
        { $sort: groupedSort(opts) },
        { $skip: skip },
        { $limit: limit },
        userLookupStage(),
        { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      ];

  const [facet] = await conversations
    .aggregate<{
      total: { n: number }[];
      page: Array<{
        _id: string;
        conversationCount: number;
        messageSum: number;
        lastChannel?: string | null;
        lastAgent?: string | null;
        lastAgentId?: string | null;
        u?: {
          _id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          reference_id?: string | null;
          enrichment?: { status?: string | null };
          stats?: {
            first_seen_at?: Date | null;
            last_seen_at?: Date | null;
            conversation_count?: number;
          };
          properties?: unknown;
        };
      }>;
    }>(
      [
        ...uniqueCustomerPipeline(convMatch),
        {
          $facet: {
            total: [{ $count: "n" }],
            page: pagePipeline,
          },
        },
      ],
      AGG_OPTS,
    )
    .toArray();

  const totalItems = facet?.total?.[0]?.n || 0;
  const items = (facet?.page || []).map((row) => {
    const u = row.u;
    const ch = parseChannel(row.lastChannel || null);
    const id = String(row._id);
    return {
      id,
      name: u
        ? displayName({ ...u, _id: id })
        : id,
      email: u?.email ?? null,
      phone: u?.phone ?? null,
      referenceId: u?.reference_id ?? null,
      enrichmentStatus: u?.enrichment?.status ?? null,
      firstSeenAt: u?.stats?.first_seen_at ?? null,
      lastSeenAt: u?.stats?.last_seen_at ?? null,
      conversationCount: row.conversationCount,
      messageCount: row.messageSum,
      lastChannel: row.lastChannel ?? null,
      lastChannelKind: ch.label,
      lastChannelIdentity: ch.identity,
      lastAgent: row.lastAgent ?? null,
      lastAgentId: row.lastAgentId || null,
      raw: {
        id,
        email: u?.email ?? null,
        phone: u?.phone ?? null,
        reference_id: u?.reference_id ?? null,
        properties: u?.properties,
        stats: u?.stats,
      },
    };
  });

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
    platform: await lookupPlatformCustomer({
      phone: u.phone,
      email: u.email,
      referenceId: u.reference_id,
    }),
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
  messageType?: string | null;
  detailedMessageType?: string | null;
  text: string;
  hasAttachment: boolean;
  attachments: EmbeddedMessage["attachments"];
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
    .aggregate(
      [
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
      ],
      { allowDiskUse: true, maxTimeMS: 60_000 },
    )
    .toArray();

  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);

  const items: ChatMessageRow[] = slice.map((r) => ({
    ...mapChatMessage(r.message as EmbeddedMessage, {
      conversationId: r.conversationId as string,
      channelName: (r.channelName as string) || null,
      channelId: (r.channelId as string) || null,
    }),
  }));

  return { items, hasMore };
}

/** Exact CSV of all customers matching filters (no row cap). */
export async function exportCustomersCsv(
  opts: ConversationFilters & { q?: string },
) {
  const { conversations } = await collections();
  const convMatch = await conversationMatchForCustomers(opts);

  const cursor = conversations.aggregate(
    [
      ...uniqueCustomerPipeline(convMatch),
      { $sort: { lastAt: -1 } },
      userLookupStage(),
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
    ],
    { ...AGG_OPTS, batchSize: 50 },
  );

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

  const data: unknown[][] = [];
  for await (const row of cursor) {
    const id = String(row._id);
    const u = row.u as
      | {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          reference_id?: string | null;
          enrichment?: { status?: string | null };
          stats?: { first_seen_at?: Date | null; last_seen_at?: Date | null };
        }
      | undefined;
    const ch = parseChannel((row.lastChannel as string) || null);
    data.push([
      id,
      u ? displayName({ ...u, _id: id }) : id,
      u?.email ?? "",
      u?.phone ?? "",
      u?.reference_id ?? "",
      row.lastChannel ?? "",
      ch.label,
      ch.identity,
      row.lastAgent ?? "",
      row.lastAgentId ?? "",
      row.conversationCount ?? 0,
      row.messageSum ?? 0,
      u?.stats?.first_seen_at?.toISOString?.() || "",
      u?.stats?.last_seen_at?.toISOString?.() || "",
      u?.enrichment?.status ?? "",
    ]);
  }

  return {
    csv: toCsv(headers, data),
    exported: data.length,
    totalMatched: data.length,
    truncated: false,
  };
}

/** Exact CSV of one customer's messages (chat transcript + Freshchat raw columns). */
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

  const convos = await conversations.find(match).sort({ created_at: 1 }).toArray();
  const allMessages = convos.flatMap((c) => c.messages || []);
  const rawKeys = collectRawColumnKeys(allMessages);
  const headers = [
    "user_id",
    "user_name",
    "user_email",
    "user_phone",
    ...messageExportHeaders(rawKeys),
  ];

  const userName = u ? displayName(u) : opts.userId;
  const data: unknown[][] = [];
  for (const c of convos) {
    const msgs = [...(c.messages || [])].sort((a, b) => {
      const t = a.created_at.getTime() - b.created_at.getTime();
      return t !== 0 ? t : a.message_id.localeCompare(b.message_id);
    });
    for (const m of msgs) {
      data.push([
        opts.userId,
        userName,
        u?.email ?? "",
        u?.phone ?? "",
        ...messageExportRow(c, m, rawKeys),
      ]);
    }
  }

  return {
    csv: toCsv(headers, data),
    exported: data.length,
    totalMatched: data.length,
    truncated: false,
  };
}

