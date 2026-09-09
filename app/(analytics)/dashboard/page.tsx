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
import { getKpis, getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import { filtersFromSearchParams } from "@/lib/filter-defaults";

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
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Freshchat metrics for {filters.from} → {filters.to} (
          {cfg.REPORTING_TIMEZONE}) — overall, by channel, and by who responded
        </p>
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
          <code>docs/ENV.md</code>), then run <code>npm run sync:year</code>.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionTitle>Overall KPIs</SectionTitle>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Conversations" value={fmtInt(k?.total)} />
        <Kpi label="Unique users" value={fmtInt(k?.uniqueUsers)} />
        <Kpi label="Resolution rate" value={fmtPct(k?.resolutionRate)} />
        <Kpi label="Reopen rate" value={fmtPct(k?.reopenRate)} />
        <Kpi
          label="Avg CSAT"
          value={fmtNum(k?.averageCsat)}
          footnote={
            k ? `Based on ${k.ratedCount} of ${k.total} rated` : undefined
          }
        />
        <Kpi label="% Satisfied (≥4)" value={fmtPct(k?.satisfiedRate)} />
        <Kpi label="CSAT response rate" value={fmtPct(k?.csatResponseRate)} />
        <Kpi label="Label coverage" value={fmtPct(k?.labelCoverage)} />
        <Kpi label="Avg messages / chat" value={fmtNum(k?.avgMessages)} />
        <Kpi
          label="Avg first response"
          value={fmtDuration(k?.avgFirstResponseSeconds)}
        />
        <Kpi
          label="Avg resolution time"
          value={fmtDuration(k?.avgResolutionSeconds)}
        />
        <Kpi
          label="Unassigned chats"
          value={fmtInt(k?.unassignedCount)}
          footnote={k ? `${fmtPct(k.unassignedRate)} of total` : undefined}
        />
        <Kpi label="Agents in range" value={fmtInt(k?.agentCount)} />
        <Kpi label="Channels in range" value={fmtInt(k?.channelCount)} />
      </div>

      <SectionTitle>Trends & distribution</SectionTitle>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <DailyVolumeChart data={data?.charts.dailyVolume || []} />
        <DailyCsatChart data={data?.charts.dailyCsat || []} />
        <CsatDistributionChart data={data?.charts.csatDistribution || []} />
        <ChannelBarChart data={data?.charts.byChannel || []} />
        <SubjectBarChart data={data?.charts.bySubject || []} />
        <AgentVolumeChart data={data?.charts.agentVolume || []} />
        <AgentCsatChart data={data?.charts.averageCsatByAgent || []} />
      </div>

      <SectionTitle>By channel (in depth)</SectionTitle>
      <div className="mb-8">
        <BreakdownTable
          title="Channel performance"
          subtitle="Volume, resolution, CSAT, and response times per Freshchat channel"
          nameHeader="Channel"
          rows={data?.breakdowns.byChannel || []}
        />
      </div>

      <SectionTitle>By who&apos;s responding (agents)</SectionTitle>
      <div className="mb-8">
        <BreakdownTable
          title="Agent performance"
          subtitle="Assigned agent from Freshchat — chats handled, CSAT, FRT, resolution time"
          nameHeader="Agent"
          rows={data?.breakdowns.byAgent || []}
        />
      </div>

      <SectionTitle>By group</SectionTitle>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function Kpi({
  label,
  value,
  footnote,
}: {
  label: string;
  value: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {footnote && (
        <div className="mt-1 text-[11px] text-slate-400">{footnote}</div>
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
