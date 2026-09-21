import { Suspense } from "react";
import Link from "next/link";
import { DissatisfiedBoard } from "@/components/DissatisfiedBoard";
import { FilterBar } from "@/components/FilterBar";
import { BreakdownTable } from "@/components/BreakdownTable";
import { KpiTile, SectionTitle } from "@/components/KpiTile";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { InfoTip } from "@/components/ui/InfoTip";
import { getDissatisfiedBoard, getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { conversationsHref } from "@/lib/dashboard-links";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { filtersToQuery } from "@/lib/filters";
import { fmtDuration, fmtInt, fmtNum, fmtPct } from "@/lib/format-kpi";
import { timezoneLabel } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  let data: Awaited<ReturnType<typeof getKpis>> | null = null;
  let sync: Awaited<ReturnType<typeof getSyncStatus>> | null = null;
  let dissatisfied: Awaited<ReturnType<typeof getDissatisfiedBoard>> = [];
  let error: string | null = null;

  try {
    [data, sync, dissatisfied] = await Promise.all([
      getKpis(filters),
      getSyncStatus(),
      getDissatisfiedBoard(filters),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const cfg = getConfig();
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
            Dashboard
            <InfoTip text="All KPIs and charts use the same filter set (dates in selected timezone, responders, customers, channel, labels, CSAT). Numbers come from synced Freshchat data only." />
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {filters.from} → {filters.to} ({timezoneLabel(filters.timeZone)}) ·{" "}
            {cfg.APP_BRAND_NAME}
            {" · "}
            <Link href="/data-flow" className="text-[var(--brand)] hover:underline">
              Data flow
            </Link>
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

      {sync?.state === "never_run" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No sync yet. Set credentials in <code>.env.local</code> (see{" "}
          <code>docs/ENV.md</code>), then run <code>npm run sync</code>.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionTitle tip="Headline metrics for conversations matching the filters above. Click a tile to open matching raw conversations.">
        Overall KPIs
      </SectionTitle>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile
          label="Conversations"
          tip="Count of Freshchat conversations in range (one row per conversation_id). Click to open the table."
          value={fmtInt(k?.total)}
          href={raw()}
        />
        <KpiTile
          label="Open chats"
          tip="Conversations not marked resolved."
          value={fmtInt(k?.openCount)}
          footnote={k ? `${fmtPct(k.openRate)} of total` : undefined}
          href={raw({ resolved: "false" })}
        />
        <KpiTile
          label="Unique users"
          tip="Distinct primary_user_id values (customers)."
          value={fmtInt(k?.uniqueUsers)}
          href={`/users?${baseQuery}`}
        />
        <KpiTile
          label="Resolution rate"
          tip="resolved=true ÷ total conversations."
          value={fmtPct(k?.resolutionRate)}
          href={raw({ resolved: "true" })}
        />
        <KpiTile
          label="Reopen rate"
          tip="reopened=true ÷ total (Freshchat reopen flag when present)."
          value={fmtPct(k?.reopenRate)}
          href={raw({ reopened: "true" })}
        />
        <KpiTile
          label="Avg CSAT"
          tip="Average of csat.rating where rated. Footnote shows rated n of total."
          value={fmtNum(k?.averageCsat)}
          footnote={
            k ? `Based on ${k.ratedCount} of ${k.total} rated` : undefined
          }
          href={raw({ csat: "rated" })}
        />
        <KpiTile
          label="% Satisfied (≥4)"
          tip="Ratings ≥4 ÷ rated count."
          value={fmtPct(k?.satisfiedRate)}
          href={raw({ csat: "satisfied" })}
        />
        <KpiTile
          label="% Dissatisfied (≤2)"
          tip="Ratings ≤2 ÷ rated count."
          value={fmtPct(k?.dissatisfiedRate)}
          href={raw({ csat: "dissatisfied" })}
        />
        <KpiTile
          label="CSAT response rate"
          tip="Rated chats ÷ total conversations. Industry 20–30% is usually rated ÷ surveys offered — this includes chats that never got a survey."
          value={fmtPct(k?.csatResponseRate)}
          footnote={
            k
              ? `${k.ratedCount.toLocaleString()} of ${k.total.toLocaleString()} chats`
              : undefined
          }
          href={raw({ csat: "unrated" })}
        />
        <KpiTile
          label="CSAT on resolved"
          tip="Rated resolved chats ÷ resolved chats. Closer to a survey-completion rate when Freshchat sends CSAT on resolve."
          value={fmtPct(k?.csatResponseRateResolved)}
          footnote={
            k
              ? `${k.ratedResolvedCount.toLocaleString()} of resolved`
              : undefined
          }
          href={raw({ csat: "unrated", resolved: "true" })}
        />
        <KpiTile
          label="Label coverage"
          tip="Chats with a non-empty Freshchat resolution label ÷ total. Keyword inference never counts here."
          value={fmtPct(k?.labelCoverage)}
          href={raw({ subject: "unlabeled" })}
        />
        <KpiTile
          label="Derived coverage"
          tip="Chats with a derived subject (Freshchat label, or keyword if CLASSIFY_ENABLED). Label coverage stays agent tags only."
          value={fmtPct(k?.derivedCoverage)}
          footnote={
            k
              ? `${k.derivedCount.toLocaleString()} with a subject`
              : undefined
          }
          href={raw({ subjectSource: "none" })}
        />
        <KpiTile
          label="Avg messages / chat"
          tip="Sum of message_count ÷ conversations."
          value={fmtNum(k?.avgMessages)}
          href={raw()}
        />
        <KpiTile
          label="With attachments"
          tip="Chats that include at least one attachment in the transcript."
          value={fmtInt(k?.chatsWithAttachments)}
          footnote={k ? `${fmtPct(k.attachmentRate)} of total` : undefined}
          href={raw()}
        />
        <KpiTile
          label="Avg first response"
          tip="Average first-response-time seconds from Freshchat Extract (chats with FRT only)."
          value={fmtDuration(k?.avgFirstResponseSeconds)}
          href={raw()}
        />
        <KpiTile
          label="Median FRT"
          tip="Median first-response time — less skewed by outliers than the average."
          value={fmtDuration(k?.medianFirstResponseSeconds)}
          href={raw({ sort: "frt", order: "asc" })}
        />
        <KpiTile
          label="p90 FRT"
          tip="90th percentile first-response time among chats with FRT."
          value={fmtDuration(k?.p90FirstResponseSeconds)}
          href={raw({ sort: "frt", order: "desc" })}
        />
        <KpiTile
          label="% FRT > 2 min"
          tip="Share of chats with first-response ≥ 120s (industry SLA). Click to open those chats."
          value={fmtPct(k?.frtOverSlaRate)}
          footnote={
            k
              ? `${k.frtOverSlaCount.toLocaleString()} of ${k.frtWithMetricCount.toLocaleString()} with FRT`
              : undefined
          }
          href={raw({ frt: "over120", sort: "frt", order: "desc" })}
        />
        <KpiTile
          label="Avg resolution time"
          tip="Average resolution-time seconds from Extract."
          value={fmtDuration(k?.avgResolutionSeconds)}
          href={raw({ resolved: "true" })}
        />
        <KpiTile
          label="Median resolution"
          tip="Median time to resolve among chats with resolution-time data."
          value={fmtDuration(k?.medianResolutionSeconds)}
          href={raw({ resolved: "true" })}
        />
        <KpiTile
          label="Unassigned chats"
          tip="No assigned_agent_id on the conversation."
          value={fmtInt(k?.unassignedCount)}
          footnote={k ? `${fmtPct(k.unassignedRate)} of total` : undefined}
          href={raw({ agent: "unassigned" })}
        />
        <KpiTile
          label="Responders"
          tip="Distinct assigned agents appearing in this filter range."
          value={fmtInt(k?.agentCount)}
          href={raw()}
        />
        <KpiTile
          label="Channels"
          tip="Distinct channel_name values in range."
          value={fmtInt(k?.channelCount)}
          href={raw()}
        />
        <KpiTile
          label="Groups"
          tip="Distinct Freshchat groups in range."
          value={fmtInt(k?.groupCount)}
          href={raw()}
        />
      </div>

      <SectionTitle tip="Click a bar/slice/point to open matching conversations with the same date range and filters.">
        Trends & distribution
      </SectionTitle>
      <DashboardCharts charts={data?.charts} baseQuery={baseQuery} />

      <SectionTitle tip="1–2★ chats in this filter: comment, opener, keyword themes, label, channel, agent, FRT.">
        Why 1–2 star ratings
      </SectionTitle>
      <DissatisfiedBoard rows={dissatisfied} baseQuery={baseQuery} />

      <SectionTitle tip="Deep breakdown: click a row name to open matching conversations. Sort Unrated % or Dissat. % for CSAT loops.">
        By channel (in depth)
      </SectionTitle>
      <div className="mb-6">
        <BreakdownTable
          title="Channel performance"
          subtitle="Volume, resolution, CSAT, and response times per Freshchat channel — click name for raw data"
          nameHeader="Channel"
          rows={data?.breakdowns.byChannel || []}
          baseQuery={baseQuery}
          linkKind="channel"
        />
      </div>

      <SectionTitle tip="Assigned agent from Freshchat — who’s responding.">
        By responder
      </SectionTitle>
      <div className="mb-6">
        <BreakdownTable
          title="Responder performance"
          subtitle="Assigned agent — click name to open their conversations"
          nameHeader="Responder"
          rows={data?.breakdowns.byAgent || []}
          baseQuery={baseQuery}
          linkKind="agent"
        />
      </div>

      <SectionTitle tip="Freshchat group routing dimension.">
        By group
      </SectionTitle>
      <div className="mb-4">
        <BreakdownTable
          title="Group performance"
          subtitle="Freshchat group routing — click name for raw data"
          nameHeader="Group"
          rows={data?.breakdowns.byGroup || []}
          baseQuery={baseQuery}
          linkKind="group"
        />
      </div>
    </div>
  );
}
