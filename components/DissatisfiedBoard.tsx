import Link from "next/link";
import { fmtDuration } from "@/lib/format-kpi";
import { matchThemeLabels } from "@/lib/insights/themes";
import type { DissatisfiedBoardRow } from "@/lib/kpis";
import { conversationsHrefFromQuery } from "@/lib/dashboard-links";

function clip(text: string, max = 180) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function DissatisfiedBoard({
  rows,
  baseQuery,
}: {
  rows: DissatisfiedBoardRow[];
  baseQuery: string;
}) {
  const allHref = conversationsHrefFromQuery(baseQuery, {
    csat: "dissatisfied",
    sort: "csat",
    order: "asc",
  });

  if (rows.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
        No 1–2★ ratings in this filter.
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-slate-800">
            Why 1–2 star ratings
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Worst scores first — comment, first message, label, channel, agent,
            FRT. Themes are keyword probes, not Freshchat tags.
          </p>
        </div>
        <Link
          href={allHref}
          className="shrink-0 text-xs font-medium text-[var(--brand)] hover:underline"
        >
          All dissatisfied →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Comment / opener</th>
              <th className="px-3 py-2 font-medium">Themes</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">FRT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const themes = matchThemeLabels(
                `${r.comment || ""} ${r.preview || ""}`,
              );
              return (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 align-top hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/conversations/${r.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-700"
                      title="Open conversation"
                    >
                      {r.rating ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {r.comment ? (
                      <p className="text-slate-800">“{clip(r.comment, 220)}”</p>
                    ) : (
                      <p className="text-slate-400">No CSAT comment</p>
                    )}
                    {r.preview ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Opener: {clip(r.preview, 140)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {themes.length ? (
                      <div className="flex flex-wrap gap-1">
                        {themes.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.subject}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.channel || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.agent || "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {fmtDuration(r.frtSeconds)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
