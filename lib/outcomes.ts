import type { ConversationFilters } from "@/lib/filters";
import { conversationsHref, subjectFilterValue } from "@/lib/dashboard-links";
import type { KpiResult } from "@/lib/kpis";

const RISK_KEYS = new Set([
  "plan.pause",
  "plan.renew",
  "orders.cancel",
  "billing.refund",
  "billing",
  "complaint",
]);

export function isChatRiskSubject(id: string, name: string): boolean {
  if (RISK_KEYS.has(id)) return true;
  return /\b(complaint|critical|refund|cancel|pause|skip|churn|renew)\b/i.test(
    `${id} ${name}`,
  );
}

export type OutcomeCohort = {
  id: string;
  name: string;
  n: number;
  dissatisfiedRate: number | null;
  unratedRate: number | null;
  avgCsat: number | null;
  reopenRate: number | null;
  avgFrtSeconds: number | null;
  risk: boolean;
  href: string;
};

export type OutcomeModel = {
  /** True only when analytics MySQL is configured — local warehouse never has renewal/AOV. */
  renewalJoinReady: boolean;
  platformJoinReady: boolean;
  riskShare: number | null;
  riskCount: number;
  labeledCount: number;
  unlabeledCount: number;
  cohorts: OutcomeCohort[];
};

export function buildOutcomeModel(
  data: KpiResult,
  filters: ConversationFilters,
  opts: { platformJoinReady: boolean; renewalJoinReady: boolean },
): OutcomeModel {
  const total = data.kpis.total;
  const rows = data.breakdowns.bySubject;
  let riskCount = 0;
  const cohorts: OutcomeCohort[] = rows.map((s) => {
    const risk = isChatRiskSubject(s.id, s.name);
    if (risk) riskCount += s.conversations;
    return {
      id: s.id,
      name: s.name,
      n: s.conversations,
      dissatisfiedRate: s.dissatisfiedRate,
      unratedRate: s.unratedRate,
      avgCsat: s.avgCsat,
      reopenRate: s.reopenRate,
      avgFrtSeconds: s.avgFirstResponseSeconds,
      risk,
      href: conversationsHref(filters, {
        subject: subjectFilterValue(s.id),
      }),
    };
  });
  cohorts.sort((a, b) => {
    if (a.risk !== b.risk) return a.risk ? -1 : 1;
    return (b.dissatisfiedRate ?? -1) - (a.dissatisfiedRate ?? -1);
  });

  return {
    renewalJoinReady: opts.renewalJoinReady,
    platformJoinReady: opts.platformJoinReady,
    riskShare: total ? riskCount / total : null,
    riskCount,
    labeledCount: data.kpis.total - data.kpis.unlabeledCount,
    unlabeledCount: data.kpis.unlabeledCount,
    cohorts,
  };
}
