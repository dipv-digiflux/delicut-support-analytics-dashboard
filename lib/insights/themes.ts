import { TAXONOMY, type TaxonomyEntry } from "@/lib/classify/taxonomy";
import type { ConversationFilters } from "@/lib/filters";
import {
  conversationsHref,
  subjectFilterValue,
} from "@/lib/dashboard-links";
import type { KpiResult } from "@/lib/kpis";
import { fmtPct } from "@/lib/format-kpi";

const THEMES: TaxonomyEntry[] = TAXONOMY;

export type VoiceCard = {
  key: string;
  title: string;
  count: number;
  share: number | null;
  why: string;
  quotes: string[];
  href: string;
};

export type ChatInsightModel = {
  sampled: number;
  probed: VoiceCard[];
  tagged: VoiceCard[];
  quotes: {
    id: string;
    comment: string;
    rating: number | null;
    subject: string;
    href: string;
  }[];
};

function clipQuote(text: string, max = 180) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function matchThemes(text: string): TaxonomyEntry[] {
  const hits: { entry: TaxonomyEntry; score: number }[] = [];
  for (const entry of THEMES) {
    if (entry.negative?.some((re) => re.test(text))) continue;
    let score = 0;
    for (const p of entry.patterns) {
      if (p.re.test(text)) score += p.weight;
    }
    if (score >= 2) hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 2).map((h) => h.entry);
}

/** Theme labels for a comment or opener — used by the 1–2★ board. */
export function matchThemeLabels(text: string): string[] {
  if (!text.trim()) return [];
  return matchThemes(text).map((e) => e.label);
}

function themeNeedle(entry: TaxonomyEntry): string {
  const source = entry.patterns[0]?.re.source || entry.label;
  return source
    .replace(/\\b/g, " ")
    .replace(/[^a-zA-Z ]/g, " ")
    .trim()
    .split(/\s+/)[0] || entry.label;
}

export function buildChatInsights(
  data: KpiResult,
  filters: ConversationFilters,
): ChatInsightModel {
  const raw = (patch: Record<string, string | null | undefined> = {}) =>
    conversationsHref(filters, patch);
  const voice = data.voice;
  const sampled = voice?.sampled || voice?.openers.length || 0;

  const themeBuckets = new Map<
    string,
    { entry: TaxonomyEntry; count: number; quotes: string[] }
  >();
  for (const opener of voice?.openers || []) {
    for (const entry of matchThemes(opener.text)) {
      const cur = themeBuckets.get(entry.key) || {
        entry,
        count: 0,
        quotes: [],
      };
      cur.count += 1;
      if (cur.quotes.length < 4) cur.quotes.push(clipQuote(opener.text));
      themeBuckets.set(entry.key, cur);
    }
  }

  const probed = [...themeBuckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((b) => ({
      key: b.entry.key,
      title: b.entry.label,
      count: b.count,
      share: sampled ? b.count / sampled : null,
      why: `${b.count.toLocaleString()} of ${sampled.toLocaleString()} recent openers mention this.`,
      quotes: b.quotes,
      href: raw({ q: themeNeedle(b.entry) }),
    }));

  const bySubject = new Map(data.breakdowns.bySubject.map((s) => [s.id, s]));
  const tagged = (voice?.subjectSamples || []).slice(0, 8).map(
    (s: {
      id: string;
      name: string;
      count: number;
      samples: string[];
    }) => {
      const dim = bySubject.get(s.id);
      const share = data.kpis.total ? s.count / data.kpis.total : null;
      const bits = [
        share != null ? `${fmtPct(share)} of chats` : `${s.count} chats`,
      ];
      if (dim?.resolutionRate != null) {
        bits.push(`${fmtPct(dim.resolutionRate)} resolved`);
      }
      if (dim?.avgCsat != null) bits.push(`CSAT ${dim.avgCsat.toFixed(1)}`);
      return {
        key: s.id,
        title: s.name,
        count: s.count,
        share,
        why: bits.join(" · "),
        quotes: s.samples.map((q: string) => clipQuote(q)),
        href: raw({ subject: subjectFilterValue(s.id) }),
      };
    },
  );

  const quotes = [...(voice?.quotes || [])]
    .sort((a, b) => (a.rating ?? 9) - (b.rating ?? 9))
    .slice(0, 12)
    .map((q) => ({
      id: q.id,
      comment: clipQuote(q.comment, 220),
      rating: q.rating,
      subject: q.subject === "unlabeled" ? "Unlabeled" : q.subject,
      href: q.id ? `/conversations/${q.id}` : raw(),
    }));

  return { sampled, probed, tagged, quotes };
}
