import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { BreakdownTable } from "@/components/BreakdownTable";
import { KpiTile, SectionTitle } from "@/components/KpiTile";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { InfoTip } from "@/components/ui/InfoTip";
import { getKpis } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { conversationsHref } from "@/lib/dashboard-links";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { filtersToQuery, type ConversationFilters } from "@/lib/filters";
import { fmtDuration, fmtInt, fmtNum, fmtPct } from "@/lib/format-kpi";
import { timezoneLabel } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const SALES_CHANNEL = "ZIWO";

function withSalesChannel(filters: ConversationFilters): ConversationFilters {
  return {
    ...filters,
    channel: SALES_CHANNEL,
    channelIds: [],
  };
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = withSalesChannel(filtersFromSearchParams(sp));
  const cfg = getConfig();
  const ziwoIngestReady = Boolean((cfg.ZIWO_INGEST_URI || "").trim());

  let data: Awaited<ReturnType<typeof getKpis>> | null = null;
  let error: string | null = null;
  try {
    data = await getKpis(filters);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const k = data?.kpis;
  const baseQuery = filtersToQuery(filters);
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
            Phone Sales
            <InfoTip text="Freshchat Phone-ZIWO channel only. Not a dialer CRM. Connect rate, talk-time, and revenue per agent need a ZIWO call ingest." />
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {filters.from} → {filters.to} ({timezoneLabel(filters.timeZone)}) ·{" "}
            channel contains {SALES_CHANNEL}
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

      <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        {ziwoIngestReady ? (
          <>ZIWO ingest URI is set — call-level metrics are still not merged into this warehouse.</>
        ) : (
          <>
            These numbers are <strong>Freshchat chats</strong> whose channel
            name contains <code>ZIWO</code> (usually <code>Phone-ZIWO</code>
            ). They are not outbound sales calls. Connect rate, talk-time
            p50/p90, dispositions, and revenue per agent wait on a ZIWO (or
            equivalent) export into a <code>calls</code> collection.
          </>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && (k?.total ?? 0) === 0 && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          No Phone-ZIWO chats in this date range. The dashboard is unchanged;
          this page stays empty until those chats (or a real call ingest)
          exist.
        </div>
      )}

      <SectionTitle tip="Same KPI formulas as Dashboard, locked to the ZIWO channel filter. Click a tile for matching chats.">
        Phone-ZIWO chats (not sales CRM)
      </SectionTitle>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile
          label="Chats"
          value={fmtInt(k?.total)}
          href={raw()}
        />
        <KpiTile
          label="Unique users"
          value={fmtInt(k?.uniqueUsers)}
          href={`/users?${baseQuery}`}
        />
        <KpiTile
          label="Resolution rate"
          value={fmtPct(k?.resolutionRate)}
          href={raw({ resolved: "true" })}
        />
        <KpiTile
          label="Avg CSAT"
          value={fmtNum(k?.averageCsat)}
          footnote={
            k ? `Based on ${k.ratedCount} of ${k.total} rated` : undefined
          }
          href={raw({ csat: "rated" })}
        />
        <KpiTile
          label="% Dissatisfied (≤2)"
          value={fmtPct(k?.dissatisfiedRate)}
          href={raw({ csat: "dissatisfied" })}
        />
        <KpiTile
          label="Median FRT"
          value={fmtDuration(k?.medianFirstResponseSeconds)}
          href={raw({ sort: "frt", order: "asc" })}
        />
        <KpiTile
          label="% FRT > 2 min"
          value={fmtPct(k?.frtOverSlaRate)}
          href={raw({ frt: "over120", sort: "frt", order: "desc" })}
        />
        <KpiTile
          label="Label coverage"
          tip="Freshchat agent tags only."
          value={fmtPct(k?.labelCoverage)}
          href={raw({ subject: "unlabeled" })}
        />
        <KpiTile
          label="Connect rate"
          tip="Needs ZIWO connected-call flag. Not invented from chats."
          value="—"
          footnote="Awaiting call ingest"
        />
        <KpiTile
          label="Talk-time p50 / p90"
          tip="Needs ZIWO talk time. Chat FRT is a different metric."
          value="—"
          footnote="Awaiting call ingest"
        />
        <KpiTile
          label="Revenue / agent"
          tip="Needs joined analytics orders, not Phone-ZIWO transcripts."
          value="—"
          footnote="Awaiting call ingest"
        />
        <KpiTile
          label="Responders"
          value={fmtInt(k?.agentCount)}
          href={raw()}
        />
      </div>

      <SectionTitle tip="Volume and CSAT for the ZIWO channel only. Heatmap is chat created-time, not call start.">
        Trends (chat channel)
      </SectionTitle>
      <DashboardCharts charts={data?.charts} baseQuery={baseQuery} />

      <SectionTitle tip="Assigned Freshchat agent on the Phone-ZIWO conversation — not a sales-dialer agent id.">
        By responder
      </SectionTitle>
      <div className="mb-4">
        <BreakdownTable
          title="Responder performance"
          subtitle="Phone-ZIWO chats — click name to open conversations"
          nameHeader="Responder"
          rows={data?.breakdowns.byAgent || []}
          baseQuery={baseQuery}
          linkKind="agent"
        />
      </div>
    </div>
  );
}
