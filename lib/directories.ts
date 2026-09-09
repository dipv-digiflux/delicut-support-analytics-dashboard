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
}

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  _id: string;
}): string {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email || u._id;
}

export async function searchDirectory(opts: {
  role: "user" | "agent";
  q?: string;
  limit?: number;
}): Promise<DirectoryItem[]> {
  const { users } = await collections();
  const limit = Math.min(
    opts.limit ?? getConfig().DIRECTORY_SEARCH_LIMIT,
    100,
  );
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

  const rows = await users
    .find(filter)
    .sort({ "stats.last_seen_at": -1 })
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

  const items = rows.map((u) => ({
    id: String(u._id),
    name: displayName({
      _id: String(u._id),
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
    }),
    email: u.email ?? null,
    phone: u.phone ?? null,
    role: u.role as "user" | "agent",
    lastSeenAt: u.stats?.last_seen_at ?? null,
  }));

  if (opts.role === "agent" && !opts.q) {
    items.unshift({
      id: "unassigned",
      name: "Unassigned",
      email: null,
      phone: null,
      role: "agent",
      lastSeenAt: null,
    });
  }

  return items;
}

export async function listChannels(q?: string, limit = 40) {
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

  return items.slice(0, Math.min(limit, 100));
}
