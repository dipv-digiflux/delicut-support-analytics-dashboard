import Link from "next/link";
import type { MixSlice } from "@/lib/insights/briefing";
import { fmtPct } from "@/lib/format-kpi";

const KIND_NOTE: Record<string, string> = {
  growth: "Trial, new lead, monthly — demand you want more of.",
  service: "Delivery, quality, access — keep the promise.",
  risk: "Pause, cancel, refund, complaint — churn language.",
  other: "Unlabeled or uncategorized.",
};

export function MixStrip({
  mix,
  title = "Demand mix",
  tip = "How tagged chats split for a C-level read — growth vs service vs risk. Click a bucket to open the largest slice.",
}: {
  mix: MixSlice[];
  title?: string;
  tip?: string;
}) {
  if (mix.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      <p className="mb-3 text-xs text-[var(--muted)]">{tip}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {mix.map((slice) => (
          <Link
            key={slice.kind}
            href={slice.href}
            className="block rounded-lg border border-[var(--border)] bg-white p-3 transition hover:border-[var(--brand)]"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {slice.label}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-[var(--brand-ink)]">
              {fmtPct(slice.share)}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {slice.count.toLocaleString()} chats
              {slice.topName ? ` · led by ${slice.topName}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {KIND_NOTE[slice.kind]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
