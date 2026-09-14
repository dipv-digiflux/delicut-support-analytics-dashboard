import Link from "next/link";
import type { BriefingItem, ChiefBriefing } from "@/lib/insights/briefing";

const TONE: Record<
  BriefingItem["tone"],
  { bar: string; label: string }
> = {
  act: { bar: "bg-red-500", label: "Act" },
  watch: { bar: "bg-amber-500", label: "Watch" },
  ok: { bar: "bg-emerald-600", label: "OK" },
};

export function ChiefBriefingPanel({ briefing }: { briefing: ChiefBriefing }) {
  if (briefing.items.length === 0) return null;
  return (
    <div className="mb-6 rounded-lg border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="mt-0.5 text-xs text-slate-600">
          <span className="font-medium text-[var(--brand-ink)]">
            {briefing.role}.
          </span>{" "}
          {briefing.stance}
        </p>
      </div>
      <ol className="divide-y divide-[var(--border)]">
        {briefing.items.map((item) => {
          const tone = TONE[item.tone];
          return (
            <li key={item.ask}>
              <Link
                href={item.href}
                className="flex gap-3 px-4 py-2.5 transition hover:bg-[var(--brand-soft)]"
                title="Open matching conversations"
              >
                <span
                  className={`mt-1 h-8 w-1 shrink-0 rounded ${tone.bar}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--brand-ink)]">
                      {item.ask}
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {tone.label}
                    </span>
                  </div>
                  <p className="text-xs leading-snug text-slate-600">
                    {item.finding}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
