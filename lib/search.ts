import { collections } from "@/lib/db/client";

/** Shown in the FilterBar Search field — keep in sync with match logic. */
export const SEARCH_COVERS =
  "conversation ID, customer name / phone / email / reference, agent, channel, group, label, and message text";

export const SEARCH_PLACEHOLDER = "name, phone, email, ID, label…";

/** Escape a string for use inside a Mongo `$regex`. */
export function escapeRegex(q: string): string {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve user/agent profile IDs that match free-text search so conversation
 * queries can include chats by customer name/phone/email (not only embedded fields).
 */
export async function resolveSearchUserIds(q: string): Promise<string[]> {
  const needle = q.trim();
  if (!needle) return [];

  const { users } = await collections();
  const re = { $regex: escapeRegex(needle), $options: "i" as const };

  const rows = await users
    .find({
      $or: [
        { _id: needle },
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

  return rows.map((u) => String(u._id));
}
