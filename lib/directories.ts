import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { parseChannel } from "@/lib/display/channel";

export interface DirectoryItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "user" | "agent";
  lastSeenAt: Date | null;
  secondary?: string | null;
}

export interface DirectoryPage {
  items: DirectoryItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u.phone || u._id;
}

function toItem(u: {
  _id: unknown;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  stats?: { last_seen_at?: Date | null };
}): DirectoryItem {
  const id = String(u._id);
  return {
    id,
    name: displayName({
      _id: id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
    }),
    email: u.email ?? null,
    phone: u.phone ?? null,
    role: (u.role as "user" | "agent") || "user",
    lastSeenAt: u.stats?.last_seen_at ?? null,
    secondary: u.email || u.phone || id,
  };
}

export async function searchDirectory(opts: {
  role: "user" | "agent";
  q?: string;
  limit?: number;
  page?: number;
  /** Resolve specific ids (for selected chips) — ignores page/q when set */
  ids?: string[];
}): Promise<DirectoryPage> {
  const { users } = await collections();
  const limit = Math.min(
    Math.max(1, opts.limit ?? getConfig().DIRECTORY_SEARCH_LIMIT),
    100,
  );
  const page = Math.max(1, opts.page ?? 1);
  const skip = (page - 1) * limit;

  if (opts.ids?.length) {
    const unique = [...new Set(opts.ids.filter(Boolean))].slice(0, 100);
    const rows = await users
      .find({ role: opts.role, _id: { $in: unique } })
      .project({
        first_name: 1,
        last_name: 1,
        email: 1,
        phone: 1,
        role: 1,
        stats: 1,
      })
      .toArray();
    const byId = new Map(
      rows.map((u) => [String(u._id), toItem(u as Parameters<typeof toItem>[0])]),
    );
    const items = unique
      .map((id) => byId.get(id))
      .filter((x): x is DirectoryItem => Boolean(x));
    // Synthetic unassigned for agents
    if (opts.role === "agent" && unique.includes("unassigned")) {
      items.unshift({
        id: "unassigned",
        name: "Unassigned",
        email: null,
        phone: null,
        role: "agent",
        lastSeenAt: null,
        secondary: "No agent assigned",
      });
    }
    return {
      items,
      total: items.length,
      page: 1,
      limit: items.length,
      hasMore: false,
    };
  }

  const filter: Record<string, unknown> = { role: opts.role };

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
      { reference_id: re },
    ];
  }

  const total = await users.countDocuments(filter);
  const rows = await users
    .find(filter)
    .sort({ "stats.last_seen_at": -1 })
    .skip(skip)
    .limit(limit)
    .project({
      first_name: 1,
      last_name: 1,
      email: 1,
      phone: 1,
      role: 1,
      stats: 1,
    })
    .toArray();

  const items = rows.map((u) => toItem(u as Parameters<typeof toItem>[0]));

  if (opts.role === "agent" && !opts.q && page === 1) {
    items.unshift({
      id: "unassigned",
      name: "Unassigned",
      email: null,
      phone: null,
      role: "agent",
      lastSeenAt: null,
      secondary: "No agent assigned",
    });
  }

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + rows.length < total,
  };
}

export async function listChannels(q?: string, limit = 40, page = 1) {
  const { conversations } = await collections();
  const pipeline: object[] = [
    {
      $match: {
        channel_id: { $ne: null },
        channel_name: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$channel_id",
        name: { $first: "$channel_name" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 200 },
  ];

  const rows = await conversations.aggregate(pipeline).toArray();
  let items = rows.map((r) => {
    const raw = String(r.name || r._id);
    const parsed = parseChannel(raw);
    const identity = parsed.identity || null;
    const label = identity
      ? `${parsed.label} · ${identity}`
      : parsed.label !== "Unknown"
        ? `${parsed.label}${raw && parsed.label !== raw ? ` · ${raw}` : ""}`
        : raw;
    return {
      id: String(r._id),
      name: label,
      email: raw,
      secondary: `${r.count} chats`,
      count: r.count as number,
      rawName: raw,
    };
  });

  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(needle) ||
        i.id.toLowerCase().includes(needle) ||
        i.rawName.toLowerCase().includes(needle) ||
        (i.email || "").toLowerCase().includes(needle),
    );
  }

  const total = items.length;
  const safeLimit = Math.min(Math.max(1, limit), 200);
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;
  const pageItems = items.slice(skip, skip + safeLimit);

  return {
    items: pageItems,
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: skip + pageItems.length < total,
  };
}
