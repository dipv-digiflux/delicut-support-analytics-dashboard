import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { ExportButton } from "@/components/ExportButton";
import { listConversations } from "@/lib/aggregations";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  let result: Awaited<ReturnType<typeof listConversations>> | null = null;
  let error: string | null = null;
  try {
    result = await listConversations(filters);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v));
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Raw conversations
          </h1>
          <p className="text-sm text-slate-500">
            {result
              ? `${result.totalItems.toLocaleString()} matching · Freshchat fields as synced`
              : "Searchable raw table"}
          </p>
        </div>
        <ExportButton query={qs.toString()} />
      </div>

      <Suspense fallback={null}>
        <FilterBar showSearch />
      </Suspense>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Resolved</th>
              <th className="px-3 py-2 font-medium">CSAT</th>
              <th className="px-3 py-2 font-medium">Msgs</th>
              <th className="px-3 py-2 font-medium">FRT</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(result?.items || []).map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {row.createdAt
                    ? new Date(row.createdAt).toISOString().slice(0, 10)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">
                    {row.user.name || "Unknown"}
                  </div>
                  <div className="font-mono text-xs text-slate-400">
                    {row.user.email || row.user.phone || row.user.id || "—"}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.channel || "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex max-w-[180px] truncate rounded px-1.5 py-0.5 text-xs ${
                      row.subject.slug === "unlabeled"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-blue-50 text-blue-700"
                    }`}
                    title={row.subject.label}
                  >
                    {row.subject.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{row.agent.name}</td>
                <td className="px-3 py-2">
                  {row.resolved ? (
                    <span className="text-green-700">Yes</span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                  {row.reopened ? (
                    <span className="ml-1 text-xs text-amber-600">reopened</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <CsatPill score={row.csat} />
                </td>
                <td className="px-3 py-2 text-slate-600">{row.messageCount}</td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDur(row.firstResponseSeconds)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/conversations/${row.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {result && result.items.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-10 text-center text-slate-400"
                >
                  No conversations match these filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <div>
            Page {filters.page} of {result.totalPages}
          </div>
          <div className="flex gap-2">
            {filters.page > 1 && (
              <Link
                className="rounded border border-slate-200 px-3 py-1 hover:bg-white"
                href={`/conversations?${pageQs(qs, filters.page - 1)}`}
              >
                Previous
              </Link>
            )}
            {filters.page < result.totalPages && (
              <Link
                className="rounded border border-slate-200 px-3 py-1 hover:bg-white"
                href={`/conversations?${pageQs(qs, filters.page + 1)}`}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pageQs(qs: URLSearchParams, page: number) {
  const next = new URLSearchParams(qs);
  next.set("page", String(page));
  return next.toString();
}

function CsatPill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  const color =
    score >= 4
      ? "text-green-700"
      : score === 3
        ? "text-amber-600"
        : "text-red-600";
  return <span className={`font-medium ${color}`}>{score}</span>;
}

function fmtDur(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
