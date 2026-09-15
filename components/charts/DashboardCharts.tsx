"use client";

import nextDynamic from "next/dynamic";
import { SectionTitle } from "@/components/KpiTile";
import type { KpiResult } from "@/lib/kpis";

const ChartPulse = () => (
  <div className="h-48 animate-pulse rounded bg-slate-100" />
);

const DailyCsatChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.DailyCsatChart),
  { ssr: false, loading: ChartPulse },
);
const CsatDistributionChart = nextDynamic(
  () =>
    import("@/components/charts/Charts").then((m) => m.CsatDistributionChart),
  { ssr: false, loading: ChartPulse },
);
const SubjectBarChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.SubjectBarChart),
  { ssr: false, loading: ChartPulse },
);
const AgentCsatChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.AgentCsatChart),
  { ssr: false, loading: ChartPulse },
);
const DailyVolumeChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.DailyVolumeChart),
  { ssr: false, loading: ChartPulse },
);
const ChannelBarChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.ChannelBarChart),
  { ssr: false, loading: ChartPulse },
);
const AgentVolumeChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.AgentVolumeChart),
  { ssr: false, loading: ChartPulse },
);
const ResolvedMixChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.ResolvedMixChart),
  { ssr: false, loading: ChartPulse },
);
const ActorShareChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.ActorShareChart),
  { ssr: false, loading: ChartPulse },
);
const FrtDistributionChart = nextDynamic(
  () =>
    import("@/components/charts/Charts").then((m) => m.FrtDistributionChart),
  { ssr: false, loading: ChartPulse },
);
const ResolutionDistributionChart = nextDynamic(
  () =>
    import("@/components/charts/Charts").then(
      (m) => m.ResolutionDistributionChart,
    ),
  { ssr: false, loading: ChartPulse },
);
const CsatByChannelChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.CsatByChannelChart),
  { ssr: false, loading: ChartPulse },
);
const LabelTrendChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.LabelTrendChart),
  { ssr: false, loading: ChartPulse },
);
const VolumeHeatmapChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.VolumeHeatmapChart),
  { ssr: false, loading: ChartPulse },
);

export function DashboardCharts({
  charts,
  baseQuery,
}: {
  charts: KpiResult["charts"] | undefined;
  baseQuery: string;
}) {
  return (
    <>
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DailyVolumeChart
          data={charts?.dailyVolume || []}
          baseQuery={baseQuery}
        />
        <DailyCsatChart data={charts?.dailyCsat || []} baseQuery={baseQuery} />
        <CsatDistributionChart
          data={charts?.csatDistribution || []}
          baseQuery={baseQuery}
        />
        <ResolvedMixChart
          data={charts?.resolvedMix || []}
          baseQuery={baseQuery}
        />
        <ActorShareChart data={charts?.actorShare || []} />
        <ChannelBarChart
          data={charts?.byChannel || []}
          baseQuery={baseQuery}
        />
        <SubjectBarChart
          data={charts?.bySubject || []}
          baseQuery={baseQuery}
        />
        <AgentVolumeChart
          data={charts?.agentVolume || []}
          baseQuery={baseQuery}
        />
        <AgentCsatChart
          data={charts?.averageCsatByAgent || []}
          baseQuery={baseQuery}
        />
        <CsatByChannelChart
          data={charts?.csatByChannel || []}
          baseQuery={baseQuery}
        />
        <FrtDistributionChart
          data={charts?.frtDistribution || []}
          baseQuery={baseQuery}
        />
        <ResolutionDistributionChart
          data={charts?.resolutionDistribution || []}
          baseQuery={baseQuery}
        />
      </div>

      <SectionTitle tip="Deeper patterns from the same filtered conversation set.">
        Patterns
      </SectionTitle>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <VolumeHeatmapChart
          data={charts?.volumeHeatmap || []}
          baseQuery={baseQuery}
        />
        <LabelTrendChart
          data={charts?.labelTrend || { days: [], series: [] }}
          baseQuery={baseQuery}
        />
      </div>
    </>
  );
}
