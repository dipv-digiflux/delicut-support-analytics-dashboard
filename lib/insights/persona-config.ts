import type { InsightPersona } from "@/lib/insights/types";

export const INSIGHT_PERSONAS: readonly InsightPersona[] = [
  "cx",
  "marketing",
] as const;

export function isInsightPersona(value: string): value is InsightPersona {
  return (INSIGHT_PERSONAS as readonly string[]).includes(value);
}

export const PERSONA_COPY: Record<
  InsightPersona,
  { title: string; question: string; tip: string }
> = {
  cx: {
    title: "Experience",
    question:
      "view: queue, real asks, breaks, unlabeled work.",
    tip: "Walk the briefing first — those are the five checks. Then read the chats, not Dashboard charts.",
  },
  marketing: {
    title: "Demand",
    question:
      "Chief Marketing Officer view: demand mix, churn talk, channel, brand CSAT.",
    tip: "Walk the briefing first — those are the five checks. Then read demand and comments, not Dashboard charts.",
  },
};
