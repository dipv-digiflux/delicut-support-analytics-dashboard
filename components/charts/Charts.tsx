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

const slate = "#64748b";
const blue = "#2563eb";
const csatColors = ["#dc2626", "#f97316", "#d97706", "#65a30d", "#16a34a"];

export function DailyCsatChart({
  data,
}: {
  data: { date: string; average: number; ratedCount: number }[];
}) {
  return (
    <ChartCard title="Daily CSAT trend">
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
                backgroundColor: "rgba(37,99,235,0.1)",
                fill: true,
                tension: 0.3,
              },
            ],
          }}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 1, max: 5, ticks: { color: slate } },
              x: { ticks: { color: slate, maxRotation: 0 } },
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
    <ChartCard title="CSAT distribution">
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
            plugins: { legend: { position: "bottom" } },
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
    <ChartCard title="Conversations by Freshchat label">
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.label),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: blue,
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: slate } },
              y: { ticks: { color: slate } },
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
    <ChartCard title="Daily volume (created vs resolved-by-day)">
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
            plugins: { legend: { position: "bottom" } },
            scales: {
              x: { ticks: { color: slate, maxRotation: 0 } },
              y: { ticks: { color: slate } },
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
    <ChartCard title="By channel">
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
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: slate } },
              y: { ticks: { color: slate } },
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
    <ChartCard title="Avg CSAT by agent">
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map(
              (d) => `${d.agentName}${d.ratedCount < 3 ? " *" : ""}`,
            ),
            datasets: [
              {
                data: data.map((d) => d.average),
                backgroundColor: "#0d9488",
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            plugins: {
              legend: { display: false },
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
              x: { min: 1, max: 5, ticks: { color: slate } },
              y: { ticks: { color: slate } },
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
    <ChartCard title="Who's responding — chat volume by agent">
      {data.length === 0 ? (
        <Empty />
      ) : (
        <Bar
          data={{
            labels: data.map((d) => d.agentName),
            datasets: [
              {
                data: data.map((d) => d.count),
                backgroundColor: "#275ded",
              },
            ],
          }}
          options={{
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: slate } },
              y: { ticks: { color: slate } },
            },
          }}
        />
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-700">{title}</h3>
      <div className="min-h-[220px]">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
      No data for this filter
    </div>
  );
}
