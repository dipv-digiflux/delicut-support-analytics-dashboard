import Link from "next/link";
import type { InsightAction } from "@/lib/insights/types";

const SEVERITY_STYLE: Record<
  InsightAction["severity"],
  { wrap: string; badge: string }
> = {
  high: {
    wrap: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-800",
  },
  medium: {
    wrap: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
  },
  low: {
    wrap: "border-[var(--border)] bg-white",
    badge: "bg-slate-100 text-slate-600",
  },
};

export function ActionList({ actions }: { actions: InsightAction[] }) {
  return (
    <div className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        const style = SEVERITY_STYLE[action.severity];
        return (
          <Link
            key={action.id}
            href={action.href}
            className={`block rounded-lg border p-3 transition hover:border-[var(--brand)] ${style.wrap}`}
            title="Open matching conversations"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
              >
                {action.severity}
              </span>
              <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                {action.title}
              </h3>
            </div>
            <p className="text-xs leading-snug text-slate-600">{action.why}</p>
            <p className="mt-2 text-xs font-medium text-[var(--brand)]">
              Next: {action.next}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
