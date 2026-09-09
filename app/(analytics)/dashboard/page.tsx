import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { BreakdownTable } from "@/components/BreakdownTable";
import {
  DailyCsatChart,
  CsatDistributionChart,
  SubjectBarChart,
  AgentCsatChart,
  DailyVolumeChart,
  ChannelBarChart,
  AgentVolumeChart,
} from "@/components/charts/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { timezoneLabel } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function fmtDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  let data: Awaited<ReturnType<typeof getKpis>> | null = null;
  let sync: Awaited<ReturnType<typeof getSyncStatus>> | null = null;
  let error: string | null = null;

  try {
    data = await getKpis(filters);
    sync = await getSyncStatus();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const cfg = getConfig();
  const k = data?.kpis;

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
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="mb-6 h-20 animate-pulse rounded bg-slate-100" />
        }
      >
        <FilterBar />
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

      <SectionTitle tip="Headline metrics for conversations matching the filters above.">
        Overall KPIs
      </SectionTitle>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi
          label="Conversations"
          tip="Count of Freshchat conversations in range (one row per conversation_id)."
          value={fmtInt(k?.total)}
        />
        <Kpi
          label="Open chats"
          tip="Conversations not marked resolved."
          value={fmtInt(k?.openCount)}
          footnote={k ? `${fmtPct(k.openRate)} of total` : undefined}
        />
        <Kpi
          label="Unique users"
          tip="Distinct primary_user_id values (customers)."
          value={fmtInt(k?.uniqueUsers)}
        />
        <Kpi
          label="Resolution rate"
          tip="resolved=true ÷ total conversations."
          value={fmtPct(k?.resolutionRate)}
        />
        <Kpi
          label="Reopen rate"
          tip="reopened=true ÷ total (Freshchat reopen flag when present)."
          value={fmtPct(k?.reopenRate)}
        />
        <Kpi
          label="Avg CSAT"
          tip="Average of csat.rating where rated. Footnote shows rated n of total."
          value={fmtNum(k?.averageCsat)}
          footnote={
            k ? `Based on ${k.ratedCount} of ${k.total} rated` : undefined
          }
        />
        <Kpi
          label="% Satisfied (≥4)"
          tip="Ratings ≥4 ÷ rated count."
          value={fmtPct(k?.satisfiedRate)}
        />
        <Kpi
          label="% Dissatisfied (≤2)"
          tip="Ratings ≤2 ÷ rated count."
          value={fmtPct(k?.dissatisfiedRate)}
        />
        <Kpi
          label="CSAT response rate"
          tip="Rated chats ÷ total conversations."
          value={fmtPct(k?.csatResponseRate)}
        />
        <Kpi
          label="Label coverage"
          tip="Chats with a non-empty Freshchat resolution label ÷ total."
          value={fmtPct(k?.labelCoverage)}
        />
        <Kpi
          label="Avg messages / chat"
          tip="Sum of message_count ÷ conversations."
          value={fmtNum(k?.avgMessages)}
        />
        <Kpi
          label="With attachments"
          tip="Chats that include at least one attachment in the transcript."
          value={fmtInt(k?.chatsWithAttachments)}
          footnote={k ? `${fmtPct(k.attachmentRate)} of total` : undefined}
        />
        <Kpi
          label="Avg first response"
          tip="Average first-response-time seconds from Freshchat Extract (chats with FRT only)."
          value={fmtDuration(k?.avgFirstResponseSeconds)}
        />
        <Kpi
          label="Median FRT"
          tip="Median first-response time — less skewed by outliers than the average."
          value={fmtDuration(k?.medianFirstResponseSeconds)}
        />
        <Kpi
          label="Avg resolution time"
          tip="Average resolution-time seconds from Extract."
          value={fmtDuration(k?.avgResolutionSeconds)}
        />
        <Kpi
          label="Median resolution"
          tip="Median time to resolve among chats with resolution-time data."
          value={fmtDuration(k?.medianResolutionSeconds)}
        />
        <Kpi
          label="Unassigned chats"
          tip="No assigned_agent_id on the conversation."
          value={fmtInt(k?.unassignedCount)}
          footnote={k ? `${fmtPct(k.unassignedRate)} of total` : undefined}
        />
        <Kpi
          label="Responders"
          tip="Distinct assigned agents appearing in this filter range."
          value={fmtInt(k?.agentCount)}
        />
        <Kpi
          label="Channels"
          tip="Distinct channel_name values in range."
          value={fmtInt(k?.channelCount)}
        />
        <Kpi
          label="Groups"
          tip="Distinct Freshchat groups in range."
          value={fmtInt(k?.groupCount)}
        />
      </div>

      <SectionTitle tip="Compact charts — hover for exact values. Same filters as KPIs.">
        Trends & distribution
      </SectionTitle>
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DailyVolumeChart data={data?.charts.dailyVolume || []} />
        <DailyCsatChart data={data?.charts.dailyCsat || []} />
        <CsatDistributionChart data={data?.charts.csatDistribution || []} />
        <ChannelBarChart data={data?.charts.byChannel || []} />
        <SubjectBarChart data={data?.charts.bySubject || []} />
        <AgentVolumeChart data={data?.charts.agentVolume || []} />
        <AgentCsatChart data={data?.charts.averageCsatByAgent || []} />
      </div>

      <SectionTitle tip="Deep breakdown: volume, resolution, CSAT, FRT, and resolution time per dimension.">
        By channel (in depth)
      </SectionTitle>
      <div className="mb-6">
        <BreakdownTable
          title="Channel performance"
          subtitle="Volume, resolution, CSAT, and response times per Freshchat channel"
          nameHeader="Channel"
          rows={data?.breakdowns.byChannel || []}
        />
      </div>

      <SectionTitle tip="Assigned agent from Freshchat — who’s responding.">
        By responder
      </SectionTitle>
      <div className="mb-6">
        <BreakdownTable
          title="Responder performance"
          subtitle="Assigned agent — chats handled, CSAT, FRT, resolution time"
          nameHeader="Responder"
          rows={data?.breakdowns.byAgent || []}
        />
      </div>

      <SectionTitle tip="Freshchat group routing dimension.">
        By group
      </SectionTitle>
      <div className="mb-4">
        <BreakdownTable
          title="Group performance"
          subtitle="Freshchat group routing dimension"
          nameHeader="Group"
          rows={data?.breakdowns.byGroup || []}
        />
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  tip,
}: {
  children: React.ReactNode;
  tip?: string;
}) {
  return (
    <h2 className="mb-3 flex items-center text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
      {tip && <InfoTip text={tip} />}
    </h2>
  );
}

function Kpi({
  label,
  value,
  footnote,
  tip,
}: {
  label: string;
  value: string;
  footnote?: string;
  tip?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-2.5">
      <div className="flex items-center text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-[var(--brand-ink)]">
        {value}
      </div>
      {footnote && (
        <div className="mt-0.5 text-[10px] text-[var(--muted)]">{footnote}</div>
      )}
    </div>
  );
}

function fmtInt(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}
function fmtNum(n?: number | null) {
  if (n == null) return "—";
  return n.toFixed(2);
}
function fmtPct(n?: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
