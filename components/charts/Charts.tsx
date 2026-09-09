"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

const ACTOR_COLORS: Record<string, string> = {
  user: "#275ded",
  agent: "#e31c23",
  bot: "#0d9488",
  system: "#9ca3af",
  unknown: "#d1d5db",
};

const SERIES_COLORS = ["#e31c23", "#275ded", "#0d9488", "#d97706", "#7c3aed"];

export function ResolvedMixChart({
  data,
  baseQuery = "",
}: {
  data: { status: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="Resolved vs open"
      tip="Share of resolved vs open chats. Click a slice to filter the table."
      clickable
    >
      {total === 0 ? (
        <Empty />
      ) : (
        <Doughnut
          data={{
            labels: data.map((d) => d.status),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: data.map((d) =>
                  d.status === "Resolved" ? "#16a34a" : "#f97316",
                ),
                borderWidth: 0,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const status = data[i]?.status;
                if (status === "Resolved") go({ resolved: "true" });
                else if (status === "Open") go({ resolved: "false" });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas)
                canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 10, font: { size: 10 } },
              },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function ActorShareChart({
  data,
}: {
  data: { actor: string; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="Message actors"
      tip="Share of transcript messages by actor type (customer / agent / bot / system)."
    >
      {total === 0 ? (
        <Empty />
      ) : (
        <Doughnut
          data={{
            labels: data.map((d) => d.actor),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: data.map(
                  (d) => ACTOR_COLORS[d.actor] || "#9ca3af",
                ),
                borderWidth: 0,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
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
                      ? `${((n / total) * 100).toFixed(1)}% of messages`
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

export function FrtDistributionChart({
  data,
  baseQuery = "",
}: {
  data: { bucket: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="FRT distribution"
      tip="First-response time buckets. Click a bar to browse chats (same date filters)."
      clickable
    >
      {data.every((d) => d.count === 0) ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.bucket),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: "#e31c23",
              },
            ],
          }}
          options={{
            ...compactOpts,
            onClick: (e, els) =>
              clickIndex(e, els, () => {
                go({});
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas)
                canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            scales: {
              x: { ticks: { color: slate, font: { size: 9 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function ResolutionDistributionChart({
  data,
  baseQuery = "",
}: {
  data: { bucket: string; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Resolution time distribution"
      tip="Time-to-resolve buckets among chats with resolution-time data."
      clickable
    >
      {data.every((d) => d.count === 0) ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.bucket),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: "#0d9488",
              },
            ],
          }}
          options={{
            ...compactOpts,
            onClick: (e, els) =>
              clickIndex(e, els, () => {
                go({ resolved: "true" });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas)
                canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            scales: {
              x: { ticks: { color: slate, font: { size: 9 } } },
              y: { ticks: { color: slate, font: { size: 10 } } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

export function CsatByChannelChart({
  data,
  baseQuery = "",
}: {
  data: { channel: string; average: number; ratedCount: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  return (
    <ChartCard
      title="Avg CSAT by channel"
      tip="Average CSAT per channel (* if n < 3). Click to open that channel's rated chats."
      clickable
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map(
              (d) => `${d.channel}${d.ratedCount < 3 ? " *" : ""}`,
            ),
            datasets: [
              {
                data: data.map((d) => d.average),
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
                if (channel) go({ channel, csat: "rated" });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas)
                canvas.style.cursor = elements.length ? "pointer" : "default";
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

export function LabelTrendChart({
  data,
  baseQuery = "",
}: {
  data: {
    days: string[];
    series: { label: string; counts: number[] }[];
  };
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  const empty =
    !data.days.length ||
    !data.series.length ||
    data.series.every((s) => s.counts.every((c) => c === 0));
  return (
    <ChartCard
      title="Label trend (top 5)"
      tip="Daily volume for the top Freshchat labels. Hover a day to see chat counts per label; click a point to open that day + label."
      clickable
      tall
    >
      {empty ? (
        <Empty />
      ) : (
        <Line
          data={{
            labels: data.days,
            datasets: data.series.map((s, i) => ({
              label: s.label,
              data: s.counts,
              borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
              backgroundColor: "transparent",
              tension: 0.25,
              pointRadius: 3,
              pointHoverRadius: 5,
            })),
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            onClick: (e, els) =>
              clickIndex(e, els, (i) => {
                const day = data.days[i];
                const ds = els[0]?.datasetIndex ?? 0;
                const label = data.series[ds]?.label;
                if (day && label)
                  go({ from: day, to: day, subject: label });
              }),
            onHover: (event, elements) => {
              const canvas = event.native?.target as HTMLElement | undefined;
              if (canvas)
                canvas.style.cursor = elements.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 10, font: { size: 9 } },
              },
              tooltip: {
                enabled: true,
                mode: "index",
                intersect: false,
                callbacks: {
                  title: (items) => {
                    const day = items[0]?.label || "";
                    return day ? `${day}` : "";
                  },
                  label: (ctx) => {
                    const n = Number(ctx.raw) || 0;
                    const name = ctx.dataset.label || "label";
                    return ` ${name}: ${n.toLocaleString()} ${n === 1 ? "chat" : "chats"}`;
                  },
                  footer: (items) => {
                    const total = items.reduce(
                      (s, i) => s + (Number(i.raw) || 0),
                      0,
                    );
                    return `Total (top 5): ${total.toLocaleString()}`;
                  },
                },
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

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function VolumeHeatmapChart({
  data,
  baseQuery = "",
}: {
  data: { weekday: number; hour: number; count: number }[];
  baseQuery?: string;
}) {
  const go = useNavigateQuery(baseQuery);
  const [hover, setHover] = useState<{
    weekday: number;
    hour: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const grid = Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 24 }, (_, hour) => {
      const hit = data.find((d) => d.weekday === weekday && d.hour === hour);
      return hit?.count || 0;
    }),
  );
  const hours = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <ChartCard
      title="Volume heatmap"
      tip="Conversation creates by weekday × hour in the selected timezone. Hover a cell for the count; darker = busier."
      tall
    >
      {data.length === 0 ? (
        <Empty />
      ) : (
        <div
          className="relative flex h-full flex-col gap-1 overflow-hidden"
          onMouseLeave={() => setHover(null)}
        >
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11px] shadow-md"
              style={{
                left: Math.min(Math.max(hover.x, 48), 280),
                top: Math.max(hover.y - 6, 8),
              }}
            >
              <div className="font-semibold text-[var(--brand-ink)]">
                {hover.count.toLocaleString()}{" "}
                {hover.count === 1 ? "chat" : "chats"}
              </div>
              <div className="text-[var(--muted)]">
                {DOW[hover.weekday]} · {String(hover.hour).padStart(2, "0")}:00–
                {String(hover.hour).padStart(2, "0")}:59
              </div>
            </div>
          )}
          <div className="grid grid-cols-[28px_1fr] gap-1 text-[9px] text-[var(--muted)]">
            <div />
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center">
                  {hours.includes(h) ? h : ""}
                </div>
              ))}
            </div>
          </div>
          {grid.map((row, weekday) => (
            <div
              key={weekday}
              className="grid min-h-0 flex-1 grid-cols-[28px_1fr] gap-1"
            >
              <div className="flex items-center text-[9px] text-[var(--muted)]">
                {DOW[weekday]}
              </div>
              <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px">
                {row.map((count, hour) => {
                  const intensity = count / max;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => go({})}
                      onMouseEnter={(e) => {
                        const parent = e.currentTarget.closest(".relative");
                        const rect = parent?.getBoundingClientRect();
                        const cell = e.currentTarget.getBoundingClientRect();
                        if (!rect) return;
                        setHover({
                          weekday,
                          hour,
                          count,
                          x: cell.left - rect.left + cell.width / 2,
                          y: cell.top - rect.top,
                        });
                      }}
                      className="rounded-[2px] border border-transparent hover:border-[var(--brand)]"
                      style={{
                        backgroundColor:
                          count === 0
                            ? "#f3f4f6"
                            : `rgba(227, 28, 35, ${0.12 + intensity * 0.88})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  tip,
  clickable,
  tall,
  children,
}: {
  title: string;
  tip?: string;
  clickable?: boolean;
  tall?: boolean;
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
      <div className={tall ? "h-[220px]" : "h-[160px]"}>{children}</div>
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
