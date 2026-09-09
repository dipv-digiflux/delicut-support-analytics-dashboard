function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  return n.toFixed(digits);
}

function fmtDur(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export type BreakdownRow = {
  id: string;
  name: string;
  conversations: number;
  resolved: number;
  resolutionRate: number | null;
  reopened: number;
  reopenRate: number | null;
  rated: number;
  avgCsat: number | null;
  satisfiedRate: number | null;
  csatResponseRate: number | null;
  avgMessages: number | null;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
};

export function BreakdownTable({
  title,
  subtitle,
  rows,
  nameHeader = "Name",
}: {
  title: string;
  subtitle?: string;
  rows: BreakdownRow[];
  nameHeader?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-medium text-slate-800">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{nameHeader}</th>
              <th className="px-3 py-2 font-medium">Chats</th>
              <th className="px-3 py-2 font-medium">Resolved %</th>
              <th className="px-3 py-2 font-medium">Reopen %</th>
              <th className="px-3 py-2 font-medium">Avg CSAT</th>
              <th className="px-3 py-2 font-medium">Satisfied %</th>
              <th className="px-3 py-2 font-medium">CSAT resp %</th>
              <th className="px-3 py-2 font-medium">Avg msgs</th>
              <th className="px-3 py-2 font-medium">Avg FRT</th>
              <th className="px-3 py-2 font-medium">Avg resolve</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  No data for this filter
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id + r.name}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-medium text-slate-800">
                  {r.name}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {r.conversations.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtPct(r.resolutionRate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtPct(r.reopenRate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtNum(r.avgCsat)}
                  {r.rated > 0 && (
                    <span className="ml-1 text-[11px] text-slate-400">
                      n={r.rated}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtPct(r.satisfiedRate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtPct(r.csatResponseRate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtNum(r.avgMessages, 1)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDur(r.avgFirstResponseSeconds)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDur(r.avgResolutionSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
