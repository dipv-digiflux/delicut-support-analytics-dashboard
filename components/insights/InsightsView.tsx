import { Suspense } from "react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { BreakdownTable } from "@/components/BreakdownTable";
import { KpiTile, SectionTitle } from "@/components/KpiTile";
import { ActionList } from "@/components/insights/ActionList";
import { ChiefBriefingPanel } from "@/components/insights/ChiefBriefing";
import { MixStrip } from "@/components/insights/MixStrip";
import { PersonaTabs } from "@/components/insights/PersonaTabs";
import { ProblemBoard } from "@/components/insights/ProblemBoard";
import { QuotePanel } from "@/components/insights/QuotePanel";
import { LabelTrendChart } from "@/components/charts/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { conversationsHref } from "@/lib/dashboard-links";
import { filtersToQuery, type ConversationFilters } from "@/lib/filters";
import { fmtDuration, fmtInt, fmtNum, fmtPct } from "@/lib/format-kpi";
import type { ChiefBriefing } from "@/lib/insights/briefing";
import { watchRows } from "@/lib/insights/briefing";
import { PERSONA_COPY } from "@/lib/insights/persona-config";
import type { InsightAction, InsightPersona } from "@/lib/insights/types";
import type { ChatInsightModel } from "@/lib/insights/themes";
import type { KpiResult } from "@/lib/kpis";
import { timezoneLabel } from "@/lib/timezone";

type SyncLite = { state?: string } | null;

export function InsightsView({
  persona,
  filters,
  brandName,
  data,
  insights,
  briefing,
  sync,
  error,
  actions,
}: {
  persona: InsightPersona;
  filters: ConversationFilters;
  brandName: string;
  data: KpiResult | null;
  insights: ChatInsightModel;
  briefing: ChiefBriefing;
  sync: SyncLite;
  error: string | null;
  actions: InsightAction[];
}) {
  const copy = PERSONA_COPY[persona];
  const k = data?.kpis;
  const baseQuery = filtersToQuery(filters);
  const watching = data ? watchRows(data) : [];
  const raw = (patch: Record<string, string | null | undefined> = {}) =>
    conversationsHref(filters, patch);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        {k?.total != null && (
          <span className="dc-count">
            {k.total >= 1000 ? `${(k.total / 1000).toFixed(1)}k` : k.total}
          </span>
        )}
        <div>
          <h1 className="flex items-center text-2xl font-bold text-[var(--brand-ink)]">
            {copy.title}
            <InfoTip text={copy.tip} />
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {copy.question} · {filters.from} → {filters.to} (
            {timezoneLabel(filters.timeZone)}) · {brandName}
            {" · "}
            <Link href="/dashboard" className="text-[var(--brand)] hover:underline">
              Full dashboard
            </Link>
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="mb-4 h-9 w-72 animate-pulse rounded bg-slate-100" />}>
        <PersonaTabs />
      </Suspense>

      <Suspense
        fallback={
          <div className="mb-6 h-20 animate-pulse rounded bg-slate-100" />
        }
      >
        <FilterBar defaultCollapsed />
      </Suspense>

      {sync?.state === "never_run" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No sync yet. Set credentials in <code>.env.local</code> (see{" "}
          <code>docs/ENV.md</code>), then run <code>npm run sync</code>.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ChiefBriefingPanel briefing={briefing} />

      <MixStrip
        mix={briefing.mix}
        title={persona === "cx" ? "Queue mix" : "Demand mix"}
        tip={
          persona === "cx"
            ? "How this filter splits for a CCO: growth demand, service/ops, churn talk, unlabeled. Click a bucket to open the largest slice."
            : "How tagged chats split for a CMO: growth vs service vs risk. Click a bucket to open the largest slice."
        }
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {persona === "cx" ? (
          <>
            <KpiTile
              label="Open chats"
              tip="Still open in this filter."
              value={fmtInt(k?.openCount)}
              footnote={k ? `${fmtPct(k.openRate)} of total` : undefined}
              href={raw({ resolved: "false" })}
            />
            <KpiTile
              label="Unassigned"
              tip="No assigned agent."
              value={fmtInt(k?.unassignedCount)}
              footnote={k ? `${fmtPct(k.unassignedRate)} of total` : undefined}
              href={raw({ agent: "unassigned" })}
            />
            <KpiTile
              label="Unlabeled"
              tip="No Freshchat resolution label — we cannot see the query mix."
              value={fmtInt(k?.unlabeledCount)}
              href={raw({ subject: "unlabeled" })}
            />
            <KpiTile
              label="% Dissatisfied"
              tip="Ratings ≤2 ÷ rated."
              value={fmtPct(k?.dissatisfiedRate)}
              href={raw({ csat: "dissatisfied" })}
            />
            <KpiTile
              label="Median first reply"
              tip="How long customers wait for a first human/bot reply."
              value={fmtDuration(k?.medianFirstResponseSeconds)}
            />
            <KpiTile
              label="Reopen rate"
              tip="Chats that came back after resolve."
              value={fmtPct(k?.reopenRate)}
              href={raw({ reopened: "true" })}
            />
            <KpiTile
              label="Avg CSAT"
              tip="Average rating where rated."
              value={fmtNum(k?.averageCsat)}
              footnote={k ? `${fmtInt(k.ratedCount)} rated` : undefined}
              href={raw({ csat: "rated" })}
            />
            <KpiTile
              label="Resolved"
              tip="Closed chats ÷ total in this filter."
              value={fmtPct(k?.resolutionRate)}
              href={raw({ resolved: "true" })}
            />
          </>
        ) : (
          <>
            <KpiTile
              label="Top tagged share"
              tip="Largest Freshchat label in this filter."
              value={insights.tagged[0] ? fmtPct(insights.tagged[0].share) : "—"}
              footnote={insights.tagged[0]?.title}
              href={insights.tagged[0]?.href}
            />
            <KpiTile
              label="Avg CSAT"
              tip="Average rating where rated."
              value={fmtNum(k?.averageCsat)}
              footnote={
                k ? `${k.ratedCount} of ${k.total} rated` : undefined
              }
              href={raw({ csat: "rated" })}
            />
            <KpiTile
              label="% Dissatisfied"
              tip="Ratings ≤2 ÷ rated."
              value={fmtPct(k?.dissatisfiedRate)}
              href={raw({ csat: "dissatisfied" })}
            />
            <KpiTile
              label="CSAT response"
              tip="Rated chats ÷ total. Thin response means a weak brand read."
              value={fmtPct(k?.csatResponseRate)}
              href={raw({ csat: "unrated" })}
            />
            <KpiTile
              label="Growth mix"
              tip="Trial, new lead, monthly — demand you want more of."
              value={fmtPct(
                briefing.mix.find((m) => m.kind === "growth")?.share,
              )}
              footnote={
                briefing.mix.find((m) => m.kind === "growth")?.topName ||
                undefined
              }
              href={briefing.mix.find((m) => m.kind === "growth")?.href}
            />
            <KpiTile
              label="Risk / churn talk"
              tip="Pause, cancel, refund, complaint."
              value={fmtPct(
                briefing.mix.find((m) => m.kind === "risk")?.share,
              )}
              footnote={
                briefing.mix.find((m) => m.kind === "risk")?.topName ||
                undefined
              }
              href={briefing.mix.find((m) => m.kind === "risk")?.href}
            />
            <KpiTile
              label="Unlabeled"
              tip="Demand we cannot classify until chats close with a label."
              value={fmtInt(k?.unlabeledCount)}
              footnote={k ? `${fmtPct(k.labelCoverage)} labeled` : undefined}
              href={raw({ subject: "unlabeled" })}
            />
            <KpiTile
              label="Reopen rate"
              tip="Came back after resolve — brand risk, not just ops."
              value={fmtPct(k?.reopenRate)}
              href={raw({ reopened: "true" })}
            />
          </>
        )}
      </div>

      <SectionTitle tip="Threshold rules on this filter. Click a card to open the matching chats.">
        What to do next
      </SectionTitle>
      <ActionList actions={actions} />

      <ProblemBoard
        title="What they actually asked"
        tip={`Themes from the first customer message in ${insights.sampled.toLocaleString()} recent chats in this filter. Click a card to open matching chats.`}
        cards={insights.probed}
        empty="Not enough opener text in this filter to rank problems. Try a wider date range."
      />

      <ProblemBoard
        title="How we tagged the chats"
        tip="Freshchat resolution labels, with the customer’s first message. Click a card to open that labeled slice."
        cards={insights.tagged}
        empty="No labeled chats with preview text in this filter."
      />

      {watching.length > 0 && (
        <>
          <SectionTitle
            tip={
              persona === "cx"
                ? "Labels with weak CSAT, high reopen, low resolve, or a large unlabeled pile."
                : "Labels that can leak demand or brand — weak CSAT, reopen, churn names, unlabeled."
            }
          >
            Watch list
          </SectionTitle>
          <div className="mb-6">
            <BreakdownTable
              title="Labels that need a look"
              subtitle="Sorted by risk, not volume — click a name for the chats"
              nameHeader="Label"
              rows={watching}
              baseQuery={baseQuery}
              linkKind="subject"
            />
          </div>
        </>
      )}

      <QuotePanel
        quotes={insights.quotes}
        title={
          persona === "cx"
            ? "Where comments hurt"
            : "Brand in their words"
        }
        tip={
          persona === "cx"
            ? "Lowest CSAT comments first. Click to open the chat."
            : "Rated comments in this filter — the brand read, not the ops chart."
        }
      />

      <SectionTitle tip="Which Freshchat labels are rising in this date range.">
        Rising queries
      </SectionTitle>
      <div className="mb-6">
        <LabelTrendChart
          data={data?.charts.labelTrend || { days: [], series: [] }}
          baseQuery={baseQuery}
        />
      </div>

      <SectionTitle tip="How each labeled query type closes — unique to these pages, not the Dashboard chart grid.">
        How those queries close
      </SectionTitle>
      <div className="mb-6">
        <BreakdownTable
          title="By Freshchat label"
          subtitle="Volume, resolved %, reopen, CSAT, and speed — click a name for the chats"
          nameHeader="Label"
          rows={data?.breakdowns.bySubject || []}
          baseQuery={baseQuery}
          linkKind="subject"
        />
      </div>

      <SectionTitle
        tip={
          persona === "cx"
            ? "Which channel is carrying the queue, and with what CSAT."
            : "Where this demand lands."
        }
      >
        {persona === "cx" ? "Which channel is carrying it" : "Where it comes from"}
      </SectionTitle>
      <div className="mb-4">
        <BreakdownTable
          title="By channel"
          subtitle="Channel mix and CSAT — click a name for the chats"
          nameHeader="Channel"
          rows={data?.breakdowns.byChannel || []}
          baseQuery={baseQuery}
          linkKind="channel"
        />
      </div>
    </div>
  );
}
