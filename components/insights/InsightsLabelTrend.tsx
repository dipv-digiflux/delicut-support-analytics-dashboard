"use client";

import nextDynamic from "next/dynamic";

const LabelTrendChart = nextDynamic(
  () => import("@/components/charts/Charts").then((m) => m.LabelTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded bg-slate-100" />
    ),
  },
);

export function InsightsLabelTrend({
  data,
  baseQuery,
}: {
  data: { days: string[]; series: { label: string; counts: number[] }[] };
  baseQuery: string;
}) {
  return <LabelTrendChart data={data} baseQuery={baseQuery} />;
}
