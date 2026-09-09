"use client";

import { useRouter } from "next/navigation";
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
  type ChartEvent,
  type ActiveElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import { InfoTip } from "@/components/ui/InfoTip";
import { conversationsHrefFromQuery } from "@/lib/dashboard-links";

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

function useNavigateQuery(baseQuery: string) {
  const router = useRouter();
  return (patch: Record<string, string | null | undefined>) => {
    router.push(conversationsHrefFromQuery(baseQuery, patch));
  };
}

function clickIndex(
  _event: ChartEvent,
  elements: ActiveElement[],
  onIndex: (index: number) => void,
) {
  if (!elements.length) return;
  const idx = elements[0]?.index;
  if (idx == null) return;
  onIndex(idx);
}

export function DailyCsatChart({
  data,
  baseQuery = "",
}: {
  data: { date: string; average: number; ratedCount: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Daily CSAT trend"
      tip="Average CSAT by day. Click a point to open that day's conversations."
      clickable
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
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const day = data[i]?.date;
                if (day) go({ from: day, to: day });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
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
                ticks: {
                  color: slate,
                  maxRotation: 0,
                  font: { size: 9 },
                  maxTicksLimit: 8,
                },
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
  baseQuery = "",
}: {
  data: { rating: number; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="CSAT distribution"
      tip="Count of ratings 1–5. Click a slice to open conversations with that score."
      clickable
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
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const rating = data[i]?.rating;
                if (rating != null) go({ csat: String(rating) });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 10, font: { size: 10 } },
              },
              tooltip: {
                callbacks: {
                  afterLabel: (ctx) => {
                    const n = Number(ctx.raw) || 0;
                    return total
                      ? `${((n / total) * 100).toFixed(1)}% of rated`
                      : "";
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
  baseQuery = "",
}: {
  data: { subject: string; label: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="By Freshchat label"
      tip="Volume by resolution label. Click a bar to open matching conversations."
      clickable
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.label),
            datasets: [
              { data: data.map((d) => d.count), backgroundColor: blue },
            ],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const subject = data[i]?.subject || data[i]?.label;
                if (subject) go({ subject });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
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
  baseQuery = "",
}: {
  data: { date: string; count: number; resolved: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Daily volume"
      tip="Created vs resolved by day. Click a bar to open that day's chats."
      clickable
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
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const day = data[i]?.date;
                if (!day) return;
                const datasetIndex = els[0]?.datasetIndex ?? 0;
                go({
                  from: day,
                  to: day,
                  resolved: datasetIndex === 1 ? "true" : null,
                });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 10, font: { size: 10 } },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: slate,
                  maxRotation: 0,
                  font: { size: 9 },
                  maxTicksLimit: 8,
                },
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
  baseQuery = "",
}: {
  data: { channel: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="By channel"
      tip="Volume per channel. Click a bar to open that channel's conversations."
      clickable
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.channel),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: "#6366f1",
              },
            ],
          }}
          options={{
            ...compactOpts,
            indexAxis: "y",
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const channel = data[i]?.channel;
                if (channel) go({ channel });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
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
  baseQuery = "",
}: {
  data: {
    agentId: string;
    agentName: string;
    average: number;
    ratedCount: number;
  }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Avg CSAT by responder"
      tip="CSAT by assigned agent. Click a bar to open that responder's chats."
      clickable
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
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const id = data[i]?.agentId;
                if (id) go({ agent: id, csat: "rated" });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
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
  baseQuery = "",
}: {
  data: { agentId: string; agentName: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Responder volume"
      tip="Chats per assigned agent. Click a bar to open that responder's conversations."
      clickable
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
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const id = data[i]?.agentId;
                if (id) go({ agent: id });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
            },
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
  clickable,
  children,
}: {
  title: string;
  tip?: string;
  clickable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
        {tip && <InfoTip text={tip} />}
        {clickable && (
          <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-[var(--muted)]">
            click → raw data
          </span>
        )}
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
