import Link from "next/link";
import type { ChatInsightModel } from "@/lib/insights/themes";

export function QuotePanel({
  quotes,
}: {
  quotes: ChatInsightModel["quotes"];
}) {
  if (quotes.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        In their words
      </h2>
      <p className="mb-3 text-xs text-[var(--muted)]">
        CSAT comments from this filter. Click to open the chat.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {quotes.map((q) => (
          <Link
            key={q.id + q.comment}
            href={q.href}
            className="block rounded-lg border border-[var(--border)] bg-white p-3 transition hover:border-[var(--brand)]"
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {q.rating != null && <span>CSAT {q.rating}</span>}
              <span>{q.subject}</span>
            </div>
            <p className="text-sm leading-snug text-slate-800">“{q.comment}”</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
