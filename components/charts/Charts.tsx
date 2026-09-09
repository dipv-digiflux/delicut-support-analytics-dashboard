"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import { InfoTip } from "@/components/ui/InfoTip";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const slate = "#6b7280";
const blue = "#e31c23";
const csatColors = ["#dc2626", "#f97316", "#d97706", "#65a30d", "#16a34a"];

const compactOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false as const },
    tooltip: { enabled: true },
  },
};

export function DailyCsatChart({
  data,
}: {
  data: { date: string; average: number; ratedCount: number }[];
}) {
  return (
    <ChartCard
      title="Daily CSAT trend"
      tip="Average CSAT by conversation created day (rated chats only). Hover a point for rated count."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Line
          data={{
            labels: data.map((d) => d.date),
            datasets: [
              {
                label: "Avg CSAT",
                data: data.map((d) => d.average),
                borderColor: blue,
                backgroundColor: "rgba(227,28,35,0.1)",
                fill: true,
                tension: 0.3,
              },
            ],
          }}
          options={{
            ...compactOpts,
            plugins: {
              ...compactOpts.plugins,
              tooltip: {
                callbacks: {
                  afterLabel: (ctx) => {
                    const row = data[ctx.dataIndex];
                    return row ? `Rated n=${row.ratedCount}` : "";
                  },
                },
              },
            },
            scales: {
              y: { min: 1, max: 5, ticks: { color: slate, font: { size: 10 } } },
              x: {
                ticks: { color: slate, maxRotation: 0, font: { size: 9 }, maxTicksLimit: 8 },
              },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function CsatDistributionChart({
  data,
}: {
  data: { rating: number; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="CSAT distribution"
      tip="Count of ratings 1–5 in the filtered range. Unrated chats are excluded."
    >
      {total === 0 ? (
        <Empty />
      ) : (
        <Doughnut
          data={{
            labels: data.map((d) => `${d.rating}★`),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: csatColors,
                borderWidth: 0,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
              tooltip: {
                callbacks: {
                  afterLabel: (ctx) => {
                    const n = Number(ctx.raw) || 0;
                    return total ? `${((n / total) * 100).toFixed(1)}% of rated` : "";
                  },
                },
              },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function SubjectBarChart({
  data,
}: {
  data: { subject: string; label: string; count: number }[];
}) {
  return (
    <ChartCard
      title="By Freshchat label"
      tip="Conversation volume by resolution label from Freshchat (not invented topics)."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.label),
            datasets: [{ data: data.map((d) => d.count), backgroundColor: blue }],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            scales: {
              x: { ticks: { color: slate, font: { size: 10 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function DailyVolumeChart({
  data,
}: {
  data: { date: string; count: number; resolved: number }[];
}) {
  return (
    <ChartCard
      title="Daily volume"
      tip="Created vs resolved-by-day for conversations matching current filters."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.date),
            datasets: [
              {
                label: "Created",
                data: data.map((d) => d.count),
                backgroundColor: blue,
              },
              {
                label: "Resolved",
                data: data.map((d) => d.resolved),
                backgroundColor: "#0d9488",
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
            },
            scales: {
              x: {
                ticks: { color: slate, maxRotation: 0, font: { size: 9 }, maxTicksLimit: 8 },
              },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function ChannelBarChart({
  data,
}: {
  data: { channel: string; count: number }[];
}) {
  return (
    <ChartCard
      title="By channel"
      tip="Conversation count per Freshchat channel (WhatsApp, IG, Phone, etc.)."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.channel),
            datasets: [{ data: data.map((d) => d.count), backgroundColor: "#6366f1" }],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            scales: {
              x: { ticks: { color: slate, font: { size: 10 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function AgentCsatChart({
  data,
}: {
  data: {
    agentId: string;
    agentName: string;
    average: number;
    ratedCount: number;
  }[];
}) {
  return (
    <ChartCard
      title="Avg CSAT by responder"
      tip="Average CSAT for assigned agent. * means fewer than 3 ratings — treat carefully."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map(
              (d) => `${d.agentName}${d.ratedCount < 3 ? " *" : ""}`,
            ),
            datasets: [
              { data: data.map((d) => d.average), backgroundColor: "#0d9488" },
            ],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            plugins: {
              ...compactOpts.plugins,
              tooltip: {
                callbacks: {
                  afterLabel: (ctx) => {
                    const row = data[ctx.dataIndex];
                    return `n=${row?.ratedCount ?? 0}`;
                  },
                },
              },
            },
            scales: {
              x: { min: 1, max: 5, ticks: { color: slate, font: { size: 10 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function AgentVolumeChart({
  data,
}: {
  data: { agentId: string; agentName: string; count: number }[];
}) {
  return (
    <ChartCard
      title="Responder volume"
      tip="How many chats each assigned agent handled in the filter range."
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.agentName),
            datasets: [
              { data: data.map((d) => d.count), backgroundColor: "#275ded" },
            ],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            scales: {
              x: { ticks: { color: slate, font: { size: 10 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
        {tip && <InfoTip text={tip} />}
      </h3>
      <div className="h-[160px]">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      No data for this filter
    </div>
  );
}
