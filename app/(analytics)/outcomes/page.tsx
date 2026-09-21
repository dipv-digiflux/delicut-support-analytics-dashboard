import { Suspense } from "react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { KpiTile, SectionTitle } from "@/components/KpiTile";
import { InfoTip } from "@/components/ui/InfoTip";
import { getKpis } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { conversationsHref } from "@/lib/dashboard-links";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { fmtInt, fmtNum, fmtPct } from "@/lib/format-kpi";
import { buildOutcomeModel } from "@/lib/outcomes";
import { timezoneLabel } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function fmtPctCell(n: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDur(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);
  const cfg = getConfig();
  const platformJoinReady = Boolean((cfg.PLATFORM_MONGODB_URI || "").trim());
  const renewalJoinReady = Boolean((cfg.ANALYTICS_MYSQL_URI || "").trim());

  let data: Awaited<ReturnType<typeof getKpis>> | null = null;
  let error: string | null = null;
  try {
    data = await getKpis(filters);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const k = data?.kpis;
  const model = data
    ? buildOutcomeModel(data, filters, { platformJoinReady, renewalJoinReady })
    : null;
  const raw = (patch: Record<string, string | null | undefined> = {}) =>
    conversationsHref(filters, patch);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        {k?.total != null && (
          <span className="dc-count">
            {k.total >= 1000 ? `${(k.total / 1000).toFixed(1)}k` : k.total}
          </span>
        )}
        <div>
          <h1 className="flex items-center text-2xl font-bold text-[var(--brand-ink)]">
            Chat risk
            <InfoTip text="Observational only. Pause / cancel / refund language in chats is not subscription non-renewal. Renewal and AOV need analytics MySQL." />
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {filters.from} → {filters.to} ({timezoneLabel(filters.timeZone)}) ·{" "}
            {cfg.APP_BRAND_NAME}
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="mb-6 h-20 animate-pulse rounded bg-slate-100" />
        }
      >
        <FilterBar defaultCollapsed />
      </Suspense>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {renewalJoinReady ? (
          <>Analytics warehouse is configured — renewal / AOV join is still not wired in this page.</>
        ) : (
          <>
            This is <strong>churn talk in chats</strong>, not true non-renewal.
            Set <code>ANALYTICS_MYSQL_URI</code> (and platform Mongo) to compare
            pause / quality chats against 30/60-day renewals and AOV. No causal
            claim.
          </>
        )}{" "}
        {platformJoinReady
          ? "Platform Mongo is set — order snapshot can appear on a chat."
          : "PLATFORM_MONGODB_URI is empty, so chat sidebars stay unmatched."}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionTitle tip="Same filter set as Dashboard. Risk share is subjects that look like pause / cancel / refund / complaint.">
        Experience vs risk language
      </SectionTitle>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile
          label="Conversations"
          tip="Chats in this filter."
          value={fmtInt(k?.total)}
          href={raw()}
        />
        <KpiTile
          label="Risk / churn talk"
          tip="Share of chats whose subject matches pause, skip, cancel, refund, complaint, renew."
          value={fmtPct(model?.riskShare ?? null)}
          footnote={
            model
              ? `${model.riskCount.toLocaleString()} chats`
              : undefined
          }
          href={raw()}
        />
        <KpiTile
          label="% Dissatisfied (≤2)"
          tip="Ratings ≤2 ÷ rated. Compare with satisfied, not with total chats."
          value={fmtPct(k?.dissatisfiedRate)}
          href={raw({ csat: "dissatisfied" })}
        />
        <KpiTile
          label="% Satisfied (≥4)"
          value={fmtPct(k?.satisfiedRate)}
          href={raw({ csat: "satisfied" })}
        />
        <KpiTile
          label="% FRT > 2 min"
          value={fmtPct(k?.frtOverSlaRate)}
          href={raw({ frt: "over120", sort: "frt", order: "desc" })}
        />
        <KpiTile
          label="Unlabeled (Freshchat)"
          tip="Empty agent tag. Not the same as keyword-inferred derived subject."
          value={fmtInt(k?.unlabeledCount)}
          href={raw({ subject: "unlabeled" })}
        />
        <KpiTile
          label="Derived coverage"
          value={fmtPct(k?.derivedCoverage)}
          href={raw({ subjectSource: "none" })}
        />
        <KpiTile
          label="Reopen rate"
          value={fmtPct(k?.reopenRate)}
          href={raw({ reopened: "true" })}
        />
      </div>

      <SectionTitle tip="Subjects sorted with risk language first, then highest dissatisfied %. Click a name for the chats. n is conversation count, not renewals.">
        Subject vs CSAT / reopen (observational)
      </SectionTitle>
      <div className="mb-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2 text-right">n</th>
              <th className="px-3 py-2 text-right">Avg CSAT</th>
              <th className="px-3 py-2 text-right">Dissat. %</th>
              <th className="px-3 py-2 text-right">Unrated %</th>
              <th className="px-3 py-2 text-right">Reopen %</th>
              <th className="px-3 py-2 text-right">Avg FRT</th>
            </tr>
          </thead>
          <tbody>
            {(model?.cohorts || []).map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-3 py-2">
                  <Link
                    href={row.href}
                    className="text-[var(--brand)] hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.risk ? (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                      risk talk
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.n.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(row.avgCsat)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPctCell(row.dissatisfiedRate)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPctCell(row.unratedRate)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPctCell(row.reopenRate)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtDur(row.avgFrtSeconds)}
                </td>
              </tr>
            ))}
            {!model?.cohorts.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-[var(--muted)]"
                >
                  No subjects in this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Demand and Experience briefings are unchanged. This table is observational
        — n is chat count, not renewals.
      </p>
    </div>
  );
}
