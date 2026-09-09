import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import type { EmbeddedAttachment } from "@/lib/db/types";

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u._id;
}

export async function listCustomers(opts: {
  q?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) {
  const { users, conversations } = await collections();
  const limit = opts.limit;
  const skip = (opts.page - 1) * limit;

  const userFilter: Record<string, unknown> = { role: "user" };
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    const re = {
      $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    userFilter.$or = [
      { _id: q },
      { first_name: re },
      { last_name: re },
      { email: re },
      { phone: re },
      { reference_id: re },
    ];
  }

  const totalItems = await users.countDocuments(userFilter);
  const rows = await users
    .find(userFilter)
    .sort({ "stats.last_seen_at": -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const ids = rows.map((u) => u._id);
  const dateMatch: Record<string, unknown> = {};
  if (opts.from || opts.to) {
    const range: Record<string, Date> = {};
    if (opts.from) range.$gte = new Date(`${opts.from}T00:00:00.000Z`);
    if (opts.to) {
      const end = new Date(`${opts.to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      range.$lt = end;
    }
    dateMatch.created_at = range;
  }

  const counts =
    ids.length === 0
      ? []
      : await conversations
          .aggregate([
            {
              $match: {
                ...dateMatch,
                $or: [
                  { primary_user_id: { $in: ids } },
                  { user_ids: { $in: ids } },
                ],
              },
            },
            { $unwind: { path: "$user_ids", preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: {
                  $ifNull: ["$primary_user_id", "$user_ids"],
                },
                conversationCount: { $addToSet: "$_id" },
                messageSum: { $sum: "$message_count" },
                lastChannel: { $last: "$channel_name" },
                lastAgent: { $last: "$assigned_agent_name" },
              },
            },
            {
              $project: {
                conversationCount: { $size: "$conversationCount" },
                messageSum: 1,
                lastChannel: 1,
                lastAgent: 1,
              },
            },
          ])
          .toArray();

  const countMap = new Map(counts.map((c) => [c._id as string, c]));

  return {
    items: rows.map((u) => {
      const c = countMap.get(u._id);
      return {
        id: u._id,
        name: displayName(u),
        email: u.email,
        phone: u.phone,
        referenceId: u.reference_id,
        enrichmentStatus: u.enrichment?.status ?? null,
        firstSeenAt: u.stats?.first_seen_at ?? null,
        lastSeenAt: u.stats?.last_seen_at ?? null,
        conversationCount: c?.conversationCount ?? u.stats?.conversation_count ?? 0,
        messageCount: c?.messageSum ?? 0,
        lastChannel: c?.lastChannel ?? null,
        lastAgent: c?.lastAgent ?? null,
      };
    }),
    totalItems,
    page: opts.page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  };
}

export async function getCustomer(id: string) {
  const { users } = await collections();
  const u = await users.findOne({ _id: id });
  if (!u) return null;
  return {
    id: u._id,
    name: displayName(u),
    email: u.email,
    phone: u.phone,
    role: u.role,
    properties: u.properties || {},
  };
}

export interface ChatMessageRow {
  messageId: string;
  conversationId: string;
  createdAt: Date;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  text: string;
  hasAttachment: boolean;
  attachments: EmbeddedAttachment[];
  channelName: string | null;
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
      actor_first_name?: string | null;
      actor_last_name?: string | null;
      text: string;
      has_attachment: boolean;
      attachments?: EmbeddedAttachment[];
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
      text: m.text,
      hasAttachment: m.has_attachment,
      attachments: m.attachments || [],
      channelName: (r.channelName as string) || null,
    };
  });

  return { items, hasMore };
}
