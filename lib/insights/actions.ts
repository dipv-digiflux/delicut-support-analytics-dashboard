import type { KpiResult } from "@/lib/kpis";
import {
  conversationsHref,
  subjectFilterValue,
} from "@/lib/dashboard-links";
import { fmtDuration, fmtNum, fmtPct } from "@/lib/format-kpi";
import type { ConversationFilters } from "@/lib/filters";
import { INSIGHT_THRESHOLDS as T } from "@/lib/insights/thresholds";
import type {
  InsightAction,
  InsightPersona,
  InsightSeverity,
} from "@/lib/insights/types";

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function appliesTo(actionPersona: InsightAction["persona"], persona: InsightPersona) {
  return actionPersona === "both" || actionPersona === persona;
}

function halfGrowth(counts: number[]): number | null {
  if (counts.length < 4) return null;
  const mid = Math.floor(counts.length / 2);
  const first = counts.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = counts.slice(mid).reduce((a, b) => a + b, 0);
  if (second < T.TREND_MIN_CHATS) return null;
  if (first === 0) return Number.POSITIVE_INFINITY;
  return second / first;
}

export function buildInsightActions(
  data: KpiResult,
  persona: InsightPersona,
  filters: ConversationFilters,
): InsightAction[] {
  const k = data.kpis;
  const raw = (patch: Record<string, string | null | undefined> = {}) =>
    conversationsHref(filters, patch);
  const candidates: InsightAction[] = [];

  if (k.labelCoverage != null && k.labelCoverage < T.LABEL_COVERAGE_MIN) {
    candidates.push({
      id: "unlabeled",
      persona: "both",
      severity: k.labelCoverage < 0.5 ? "high" : "medium",
      title: "Label coverage is too low",
      why: `Only ${fmtPct(k.labelCoverage)} of chats have a Freshchat resolution label (${k.unlabeledCount.toLocaleString()} unlabeled). Query mix is incomplete.`,
      next: "Open unlabeled conversations and apply resolution labels at close.",
      href: raw({ subject: "unlabeled" }),
    });
  }

  if (k.reopenRate != null && k.reopenRate > T.REOPEN_HIGH) {
    candidates.push({
      id: "reopens",
      persona: "both",
      severity: "high",
      title: "Reopen rate is elevated",
      why: `${fmtPct(k.reopenRate)} of chats were reopened in this filter — customers are coming back.`,
      next: "Read reopened chats for the same root cause and tighten the close playbook.",
      href: raw({ reopened: "true" }),
    });
  }

  if (k.dissatisfiedRate != null && k.dissatisfiedRate > T.DISSATISFIED_HIGH) {
    candidates.push({
      id: "dissatisfied",
      persona: "both",
      severity: "high",
      title: "Dissatisfied ratings are high",
      why: `${fmtPct(k.dissatisfiedRate)} of rated chats scored 1–2 (${k.ratedCount.toLocaleString()} rated).`,
      next: "Open dissatisfied conversations and fix the top labels first.",
      href: raw({ csat: "dissatisfied" }),
    });
  }

  if (
    k.medianFirstResponseSeconds != null &&
    k.medianFirstResponseSeconds > T.FRT_MEDIAN_SLOW
  ) {
    candidates.push({
      id: "slow-frt",
      persona: "cx",
      severity: "high",
      title: "First response is slow",
      why: `Median first response is ${fmtDuration(k.medianFirstResponseSeconds)} (threshold ${fmtDuration(T.FRT_MEDIAN_SLOW)}). ${fmtPct(k.frtOverSlaRate)} of chats with FRT wait more than 2 min.`,
      next: "Staff the heatmap peaks and review unassigned / bot-to-agent handoff.",
      href: raw({ frt: "over120", sort: "frt", order: "desc" }),
    });
  }

  if (
    k.medianResolutionSeconds != null &&
    k.medianResolutionSeconds > T.RESOLVE_MEDIAN_SLOW
  ) {
    candidates.push({
      id: "slow-resolve",
      persona: "cx",
      severity: "medium",
      title: "Resolution time is stretched",
      why: `Median time to resolve is ${fmtDuration(k.medianResolutionSeconds)} (threshold ${fmtDuration(T.RESOLVE_MEDIAN_SLOW)}).`,
      next: "Spot-check long-running resolved chats for missing macros or wrong queues.",
      href: raw({ resolved: "true" }),
    });
  }

  if (k.unassignedRate != null && k.unassignedRate > T.UNASSIGNED_HIGH) {
    candidates.push({
      id: "unassigned",
      persona: "cx",
      severity: "high",
      title: "Too many chats sit unassigned",
      why: `${fmtPct(k.unassignedRate)} of conversations have no assigned agent (${k.unassignedCount.toLocaleString()} chats).`,
      next: "Open unassigned chats and check routing / Intelliassign coverage.",
      href: raw({ agent: "unassigned" }),
    });
  }

  const qualitySubjects = data.breakdowns.bySubject.filter(
    (s) =>
      s.id !== "unlabeled" &&
      s.conversations >= T.SUBJECT_MIN_N &&
      s.rated >= T.RATED_MIN_N &&
      s.avgCsat != null &&
      s.avgCsat < T.CSAT_LOW,
  );
  qualitySubjects.sort((a, b) => (a.avgCsat ?? 99) - (b.avgCsat ?? 99));
  const worstSubject = qualitySubjects[0];
  if (worstSubject && k.total) {
    const share = worstSubject.conversations / k.total;
    candidates.push({
      id: "subject-quality",
      persona: "both",
      severity: "high",
      title: `${worstSubject.name} is dragging CSAT`,
      why: `${worstSubject.name} is ${fmtPct(share)} of volume with avg CSAT ${fmtNum(worstSubject.avgCsat)} (n=${worstSubject.rated}).`,
      next: "Read dissatisfied chats for that label; fix the playbook or routing.",
      href: raw({ subject: subjectFilterValue(worstSubject.id) }),
    });
  }

  const reopenSubjects = data.breakdowns.bySubject.filter(
    (s) =>
      s.id !== "unlabeled" &&
      s.conversations >= T.SUBJECT_MIN_N &&
      s.reopenRate != null &&
      s.reopenRate > T.REOPEN_HIGH,
  );
  reopenSubjects.sort((a, b) => (b.reopenRate ?? 0) - (a.reopenRate ?? 0));
  const leakySubject = reopenSubjects[0];
  if (leakySubject) {
    candidates.push({
      id: "subject-reopen",
      persona: "cx",
      severity: "high",
      title: `${leakySubject.name} keeps coming back`,
      why: `${fmtPct(leakySubject.reopenRate)} reopen on ${leakySubject.name} (${leakySubject.conversations.toLocaleString()} chats).`,
      next: "Treat this as an unresolved root cause, not a volume spike.",
      href: raw({
        subject: subjectFilterValue(leakySubject.id),
        reopened: "true",
      }),
    });
  }

  const openSubjects = data.breakdowns.bySubject.filter(
    (s) =>
      s.id !== "unlabeled" &&
      s.conversations >= T.SUBJECT_MIN_N &&
      s.resolutionRate != null &&
      s.resolutionRate < T.LABEL_COVERAGE_MIN,
  );
  openSubjects.sort((a, b) => (a.resolutionRate ?? 1) - (b.resolutionRate ?? 1));
  const stuckSubject = openSubjects[0];
  if (stuckSubject) {
    candidates.push({
      id: "subject-open",
      persona: "cx",
      severity: "medium",
      title: `${stuckSubject.name} is not closing`,
      why: `Resolution rate on ${stuckSubject.name} is ${fmtPct(stuckSubject.resolutionRate)} across ${stuckSubject.conversations.toLocaleString()} chats.`,
      next: "Open still-open chats for that label and clear the backlog.",
      href: raw({
        subject: subjectFilterValue(stuckSubject.id),
        resolved: "false",
      }),
    });
  }

  const rising = data.charts.labelTrend.series
    .map((s) => ({
      label: s.label,
      growth: halfGrowth(s.counts),
      secondHalf: s.counts
        .slice(Math.floor(s.counts.length / 2))
        .reduce((a, b) => a + b, 0),
    }))
    .filter(
      (s) =>
        s.label !== "unlabeled" &&
        s.growth != null &&
        s.growth >= T.TREND_GROWTH,
    )
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0));
  const risingLabel = rising[0];
  if (risingLabel) {
    const growthLabel =
      risingLabel.growth === Number.POSITIVE_INFINITY
        ? "new in the second half"
        : `${risingLabel.growth!.toFixed(1)}× vs the first half`;
    candidates.push({
      id: "rising-label",
      persona: "both",
      severity: "medium",
      title: `${risingLabel.label} volume is rising`,
      why: `${risingLabel.label} grew ${growthLabel} of this date range (${risingLabel.secondHalf.toLocaleString()} chats in the second half).`,
      next: "Confirm a product or campaign change; brief support with a reply template.",
      href: raw({ subject: subjectFilterValue(risingLabel.label) }),
    });
  }

  const weakChannels = data.charts.csatByChannel.filter(
    (c: { channel: string; average: number; ratedCount: number }) =>
      c.ratedCount >= T.RATED_MIN_N && c.average < T.CSAT_LOW,
  );
  weakChannels.sort(
    (
      a: { average: number },
      b: { average: number },
    ) => a.average - b.average,
  );
  const weakChannel = weakChannels[0];
  if (weakChannel) {
    candidates.push({
      id: "channel-csat",
      persona: "marketing",
      severity: "high",
      title: `${weakChannel.channel} CSAT is weak`,
      why: `${weakChannel.channel} averages CSAT ${fmtNum(weakChannel.average)} (n=${weakChannel.ratedCount}).`,
      next: "Review that channel’s entry point and the labels landing there.",
      href: raw({ channel: weakChannel.channel }),
    });
  }

  if (
    k.botOnlyRate != null &&
    k.botOnlyRate < T.BOT_ONLY_LOW &&
    data.charts.actorShare.some((a) => a.actor === "bot")
  ) {
    candidates.push({
      id: "bot-coverage",
      persona: "cx",
      severity: "low",
      title: "Almost no chats stay bot-only",
      why: `Bot-only chats are ${fmtPct(k.botOnlyRate)} of volume (derived from actor_counts, not Freshchat deflection).`,
      next: "Check whether FAQs that dominate the subject table could be answered in-bot.",
      href: raw(),
    });
  }

  if (k.csatResponseRate != null && k.csatResponseRate < T.CSAT_RESPONSE_LOW) {
    candidates.push({
      id: "csat-response",
      persona: "marketing",
      severity: "medium",
      title: "Too few customers rate the chat",
      why: `CSAT response rate is ${fmtPct(k.csatResponseRate)} (${k.ratedCount.toLocaleString()} of ${k.total.toLocaleString()} chats). On resolved chats it is ${fmtPct(k.csatResponseRateResolved)}. Brand read is thin.`,
      next: "Open unrated chats and check survey delivery on the top channels.",
      href: raw({ csat: "unrated" }),
    });
  }

  const ranked = candidates
    .filter((a) => appliesTo(a.persona, persona))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, T.MAX_ACTIONS);

  if (ranked.length === 0) {
    return [
      {
        id: "none",
        persona,
        severity: "low",
        title: "No threshold breaches in this filter",
        why: "Headline rates are inside the configured bands for this date range and filter set.",
        next: "Use the subject table to pick a focus area.",
        href: raw(),
      },
    ];
  }

  return ranked;
}
