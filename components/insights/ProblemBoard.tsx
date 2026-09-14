import Link from "next/link";
import type { VoiceCard } from "@/lib/insights/themes";

export function ProblemBoard({
  title,
  tip,
  cards,
  empty,
}: {
  title: string;
  tip?: string;
  cards: VoiceCard[];
  empty: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      {tip && <p className="mb-3 text-xs text-[var(--muted)]">{tip}</p>}
      {cards.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-6 text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {cards.map((card, i) => (
            <Link
              key={card.key}
              href={card.href}
              className="block rounded-lg border border-[var(--border)] bg-white p-3 transition hover:border-[var(--brand)]"
              title="Open matching conversations"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                  <span className="mr-2 text-[var(--muted)]">{i + 1}.</span>
                  {card.title}
                </h3>
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                  {card.count.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-600">{card.why}</p>
              {card.quotes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {card.quotes.map((q) => (
                    <li
                      key={q}
                      className="border-l-2 border-[var(--border)] pl-2 text-xs leading-snug text-slate-700"
                    >
                      “{q}”
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
