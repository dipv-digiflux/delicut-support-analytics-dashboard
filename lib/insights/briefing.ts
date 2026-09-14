import type { ConversationFilters } from "@/lib/filters";
import {
  conversationsHref,
  subjectFilterValue,
} from "@/lib/dashboard-links";
import { fmtDuration, fmtPct } from "@/lib/format-kpi";
import type { InsightPersona } from "@/lib/insights/types";
import type { ChatInsightModel } from "@/lib/insights/themes";
import type { KpiResult } from "@/lib/kpis";

export type MixKind = "growth" | "service" | "risk" | "other";

export type MixSlice = {
  kind: MixKind;
  label: string;
  count: number;
  share: number | null;
  topName: string | null;
  href: string;
};

export type BriefingItem = {
  ask: string;
  finding: string;
  tone: "ok" | "watch" | "act";
  href: string;
};

export type ChiefBriefing = {
  role: string;
  stance: string;
  items: BriefingItem[];
  mix: MixSlice[];
};

function classifyName(name: string, id: string): MixKind {
  const s = `${id} ${name}`.toLowerCase();
  if (id === "unlabeled") return "other";
  if (/\b(trial|new lead|monthly|upgrade)\b/.test(s)) return "growth";
  if (/\b(complaint|critical|refund|cancel|pause|skip|churn)\b/.test(s)) {
    return "risk";
  }
  if (
    /\b(deliver|shipping|quality|missing|login|billing|status|misc)\b/.test(s)
  ) {
    return "service";
  }
  return "other";
}

function classifyTheme(key: string): MixKind {
  if (key === "trial" || key === "plan.change") return "growth";
  if (
    key === "plan.pause" ||
    key === "orders.cancel" ||
    key === "billing.refund" ||
    key === "billing" ||
    key === "complaint"
  ) {
    return "risk";
  }
  if (
    key === "shipping" ||
    key === "quality" ||
    key === "missing" ||
    key === "orders.status" ||
    key === "account.login" ||
    key === "technical"
  ) {
    return "service";
  }
  return "other";
}

const MIX_META: Record<MixKind, { label: string; order: number }> = {
  growth: { label: "Growth demand", order: 0 },
  service: { label: "Service / ops", order: 1 },
  risk: { label: "Risk & churn talk", order: 2 },
  other: { label: "Other / unlabeled", order: 3 },
};

function mixFromCards(
  cards: { id?: string; key: string; title: string; count: number }[],
  total: number,
  hrefFor: (card: { key: string; title: string }) => string,
  kindOf: (card: { key: string; title: string }) => MixKind,
): MixSlice[] {
  const buckets = new Map<
    MixKind,
    { count: number; topName: string | null; topCount: number; href: string }
  >();
  for (const card of cards) {
    const kind = kindOf(card);
    const cur = buckets.get(kind) || {
      count: 0,
      topName: null,
      topCount: -1,
      href: hrefFor(card),
    };
    cur.count += card.count;
    if (card.count > cur.topCount) {
      cur.topCount = card.count;
      cur.topName = card.title;
      cur.href = hrefFor(card);
    }
    buckets.set(kind, cur);
  }
  return (Object.keys(MIX_META) as MixKind[])
    .map((kind) => {
      const b = buckets.get(kind);
      return {
        kind,
        label: MIX_META[kind].label,
        count: b?.count || 0,
        share: total ? (b?.count || 0) / total : null,
        topName: b?.topName || null,
        href: b?.href || "#",
      };
    })
    .filter((s) => s.count > 0);
}

function toneFrom(ok: boolean, watch: boolean): BriefingItem["tone"] {
  if (!ok) return "act";
  if (watch) return "watch";
  return "ok";
}

export function buildChiefBriefing(
  persona: InsightPersona,
  data: KpiResult,
  insights: ChatInsightModel,
  filters: ConversationFilters,
): ChiefBriefing {
  const raw = (patch: Record<string, string | null | undefined> = {}) =>
    conversationsHref(filters, patch);
  const k = data.kpis;
  const topAsk = insights.probed[0];
  const topTag = insights.tagged[0];
  const worst = [...data.breakdowns.bySubject]
    .filter((s) => s.id !== "unlabeled" && s.rated >= 5 && s.avgCsat != null)
    .sort((a, b) => (a.avgCsat ?? 99) - (b.avgCsat ?? 99))[0];
  const leaky = [...data.breakdowns.bySubject]
    .filter((s) => s.id !== "unlabeled" && s.conversations >= 20)
    .sort((a, b) => (b.reopenRate ?? 0) - (a.reopenRate ?? 0))[0];
  const topChannel = data.breakdowns.byChannel[0];

  const mix = mixFromCards(
    data.breakdowns.bySubject.map((s) => ({
      key: s.id,
      title: s.name,
      count: s.conversations,
    })),
    k.total,
    (c) => raw({ subject: subjectFilterValue(c.key) }),
    (c) => classifyName(c.title, c.key),
  );

  const askedMix = mixFromCards(
    insights.probed.map((c) => ({
      key: c.key,
      title: c.title,
      count: c.count,
    })),
    insights.sampled || 1,
    (c) => insights.probed.find((p) => p.key === c.key)?.href || raw(),
    (c) => classifyTheme(c.key),
  );

  const growth = mix.find((m) => m.kind === "growth");
  const risk = mix.find((m) => m.kind === "risk");
  const askedRisk = askedMix.find((m) => m.kind === "risk");

  if (persona === "cx") {
    const items: BriefingItem[] = [
      {
        ask: "Is the queue under control?",
        finding: k.openCount
          ? `${k.openCount.toLocaleString()} open (${fmtPct(k.openRate)}), ${k.unassignedCount.toLocaleString()} unassigned (${fmtPct(k.unassignedRate)}).`
          : "No open chats in this filter.",
        tone: toneFrom(
          (k.openRate ?? 0) < 0.25 && (k.unassignedRate ?? 0) < 0.15,
          (k.openRate ?? 0) < 0.35,
        ),
        href: raw({ resolved: "false" }),
      },
      {
        ask: "What is the #1 customer ask?",
        finding: topAsk
          ? `${topAsk.title} — ${topAsk.count.toLocaleString()} of ${insights.sampled} recent openers.`
          : topTag
            ? `${topTag.title} is the largest tagged slice (${fmtPct(topTag.share)}).`
            : "Not enough opener text to name a top ask.",
        tone: "ok",
        href: topAsk?.href || topTag?.href || raw(),
      },
      {
        ask: "Where is experience breaking?",
        finding: worst
          ? `${worst.name} has the weakest CSAT (${worst.avgCsat?.toFixed(1)} from ${worst.rated} ratings).`
          : k.dissatisfiedRate != null
            ? `${fmtPct(k.dissatisfiedRate)} of rated chats scored 1–2.`
            : "No CSAT in this filter to locate a break.",
        tone: toneFrom(
          (worst?.avgCsat ?? 5) >= 3.5 && (k.dissatisfiedRate ?? 0) <= 0.15,
          (worst?.avgCsat ?? 5) >= 4,
        ),
        href: worst
          ? raw({ subject: subjectFilterValue(worst.id) })
          : raw({ csat: "dissatisfied" }),
      },
      {
        ask: "How much of the queue is still invisible?",
        finding: `${k.unlabeledCount.toLocaleString()} unlabeled (${fmtPct(k.labelCoverage)} coverage). Unlabeled chats here are mostly still open.`,
        tone: toneFrom((k.labelCoverage ?? 1) >= 0.7, (k.labelCoverage ?? 1) >= 0.85),
        href: raw({ subject: "unlabeled" }),
      },
      {
        ask: "Are we slow or looping?",
        finding: `Median first response ${fmtDuration(k.medianFirstResponseSeconds)}. Reopen ${fmtPct(k.reopenRate)}${
          leaky?.reopenRate ? ` — highest on ${leaky.name} (${fmtPct(leaky.reopenRate)}).` : "."
        }`,
        tone: toneFrom(
          (k.medianFirstResponseSeconds ?? 0) <= 900 && (k.reopenRate ?? 0) <= 0.1,
          (k.medianFirstResponseSeconds ?? 0) <= 1800,
        ),
        href: leaky?.reopenRate && leaky.reopenRate > 0.05
          ? raw({ subject: subjectFilterValue(leaky.id), reopened: "true" })
          : raw(),
      },
    ];
    return {
      role: "",
      stance:
        "Check queue health, the real ask in customers’ words, where CSAT breaks, and anything still unlabeled.",
      items,
      mix,
    };
  }

  const items: BriefingItem[] = [
    {
      ask: "What is inbound demand made of?",
      finding: [
        growth
          ? `Growth ${fmtPct(growth.share)} (led by ${growth.topName})`
          : null,
        risk ? `Risk/churn talk ${fmtPct(risk.share)}` : null,
      ]
        .filter(Boolean)
        .join(". ") || "Not enough labels to split growth vs risk.",
      tone: toneFrom((risk?.share ?? 0) <= 0.12, (risk?.share ?? 0) <= 0.2),
      href: growth?.href || raw(),
    },
    {
      ask: "Which motion is loudest?",
      finding: topTag
        ? `${topTag.title} is ${fmtPct(topTag.share)} of tagged chats.`
        : "No dominant label in this filter.",
      tone: "ok",
      href: topTag?.href || raw(),
    },
    {
      ask: "Are customers talking like they want to leave?",
      finding: askedRisk
        ? `${askedRisk.topName || "Pause / cancel / refund"} shows up in ${askedRisk.count.toLocaleString()} of ${insights.sampled} recent openers (${fmtPct(askedRisk.share)} of the sample).`
        : risk
          ? `Tagged risk slice is ${fmtPct(risk.share)} (${risk.topName}).`
          : "Little pause / cancel / refund language in this filter.",
      tone: toneFrom(
        (askedRisk?.share ?? 0) <= 0.15 && (risk?.share ?? 0) <= 0.12,
        (askedRisk?.share ?? 0) <= 0.25,
      ),
      href: askedRisk
        ? insights.probed.find((p) => classifyTheme(p.key) === "risk")?.href ||
          raw()
        : risk?.href || raw(),
    },
    {
      ask: "Which channel owns the conversation?",
      finding: topChannel
        ? `${topChannel.name} is ${topChannel.conversations.toLocaleString()} chats (${k.total ? fmtPct(topChannel.conversations / k.total) : "—"}) · CSAT ${topChannel.avgCsat != null ? topChannel.avgCsat.toFixed(1) : "—"}.`
        : "No channel split in this filter.",
      tone: toneFrom(
        (topChannel?.avgCsat ?? 5) >= 3.5,
        (topChannel?.avgCsat ?? 5) >= 4,
      ),
      href: topChannel
        ? raw({ channel: topChannel.name })
        : raw(),
    },
    {
      ask: "Can I trust CSAT as a brand score?",
      finding: `Avg CSAT ${k.averageCsat != null ? k.averageCsat.toFixed(2) : "—"} from ${k.ratedCount.toLocaleString()} ratings (${fmtPct(k.csatResponseRate)} of chats). ${fmtPct(k.dissatisfiedRate)} scored 1–2.`,
      tone: toneFrom(
        (k.csatResponseRate ?? 0) >= 0.2 && (k.dissatisfiedRate ?? 0) <= 0.15,
        (k.csatResponseRate ?? 0) >= 0.12,
      ),
      href: raw({ csat: "rated" }),
    },
  ];

  return {
    role: "Chief Marketing Officer",
    stance:
      "Check demand mix (growth vs churn talk), the loudest product motion, the channel, and whether CSAT is a real brand read.",
    items,
    mix,
  };
}

export function watchRows(
  data: KpiResult,
): KpiResult["breakdowns"]["bySubject"] {
  const scored = data.breakdowns.bySubject
    .map((row) => {
      let score = 0;
      if (row.id === "unlabeled" && row.conversations >= 20) score += 4;
      if (row.rated >= 5 && row.avgCsat != null && row.avgCsat < 4) score += 3;
      if (row.reopenRate != null && row.reopenRate >= 0.08 && row.conversations >= 15) {
        score += 2;
      }
      if (
        row.resolutionRate != null &&
        row.resolutionRate < 0.5 &&
        row.conversations >= 15
      ) {
        score += 2;
      }
      if (/\b(complaint|refund|cancel|pause)\b/i.test(row.name)) score += 1;
      return { row, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.row.conversations - a.row.conversations);
  return scored.slice(0, 8).map((x) => x.row);
}

export function emptyBriefing(persona: InsightPersona): ChiefBriefing {
  return {
    role:
      persona === "cx" ? "" : "",
    stance: "Load a date range with synced chats to brief this view.",
    items: [],
    mix: [],
  };
}
