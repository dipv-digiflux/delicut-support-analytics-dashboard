import Link from "next/link";
import { InfoTip } from "@/components/ui/InfoTip";
import {
  HOW_IT_WORKS_INTRO,
  HOW_IT_WORKS_KPIS,
  HOW_IT_WORKS_SCREENS,
} from "@/lib/how-it-works-content";

export const dynamic = "force-dynamic";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="flex items-center text-2xl font-bold text-[var(--brand-ink)]">
          How it works
          <InfoTip text="Same map as docs/HOW_IT_WORKS.md — what each screen measures and what we are not inventing." />
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{HOW_IT_WORKS_INTRO}</p>
      </div>

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-white p-4 text-sm leading-relaxed text-[var(--foreground)]">
        <p>
          Sync CLI pulls Extract CSV + users into Mongo. This UI only reads Mongo.
          Experience and Demand briefing copy stays frozen. There is no ML model;
          keyword classify fills local <code>derived</code> only.
        </p>
        <p className="mt-2 text-[var(--muted)]">
          Full write-up for PRs: <code>docs/HOW_IT_WORKS.md</code>. Pipes and
          Extract events:{" "}
          <Link href="/data-flow" className="text-[var(--brand)] hover:underline">
            Data flow
          </Link>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Screens
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[#f8f8f9] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Screen</th>
                <th className="px-3 py-2">Answers</th>
                <th className="px-3 py-2">Honesty</th>
              </tr>
            </thead>
            <tbody>
              {HOW_IT_WORKS_SCREENS.map((s) => (
                <tr
                  key={s.path + s.name}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={s.path}
                      className="font-medium text-[var(--brand)] hover:underline"
                    >
                      {s.name}
                    </Link>
                    <div className="font-mono text-[10px] text-[var(--muted)]">
                      {s.path}
                    </div>
                  </td>
                  <td className="px-3 py-2">{s.answers}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{s.honesty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Headline numbers
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {HOW_IT_WORKS_KPIS.map((block) => (
            <div
              key={block.title}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
            >
              <div className="mb-2 text-sm font-semibold text-[var(--brand-ink)]">
                {block.title}
              </div>
              <dl className="space-y-2 text-sm">
                {block.rows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 text-[var(--foreground)]">{row.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
