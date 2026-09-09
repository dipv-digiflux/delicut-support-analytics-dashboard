import { listConversations } from "@/lib/aggregations";
import { defaultDateRange, parseFilters } from "@/lib/filters";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Open inbox — jump to newest conversation if any exist. */
export default async function InboxIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const defaults = defaultDateRange(365);
  const filters = parseFilters({
    ...sp,
    from: sp.from || defaults.from,
    to: sp.to || defaults.to,
    limit: "1",
    sort: "created_at",
    order: "desc",
  });

  try {
    const result = await listConversations(filters);
    if (result.items[0]) {
      const q = new URLSearchParams();
      if (typeof sp.q === "string" && sp.q) q.set("q", sp.q);
      if (typeof sp.resolved === "string" && sp.resolved) q.set("resolved", sp.resolved);
      const suffix = q.toString() ? `?${q}` : "";
      redirect(`/inbox/${result.items[0].id}${suffix}`);
    }
  } catch {
    // fall through to empty
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white text-sm text-slate-500">
      <div className="max-w-md px-6 text-center">
        <div className="mb-2 text-lg font-semibold text-slate-800">
          No conversations yet
        </div>
        <p>
          Sync Freshchat data first (<code>npm run sync:year</code>), then open
          Team Inbox again.
        </p>
      </div>
    </div>
  );
}
