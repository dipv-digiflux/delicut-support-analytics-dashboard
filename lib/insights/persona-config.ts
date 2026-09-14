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
      "What customers are typing, how we tagged it, and where ops should act.",
    tip: "Built from customer openers and Freshchat labels in this filter — not a repeat of the Dashboard chart grid.",
  },
  marketing: {
    title: "Demand",
    question:
      "What demand is hitting chat, in customers’ words, and what that does to brand.",
    tip: "Opener themes, labels, and CSAT comments for this filter — not a repeat of the Dashboard chart grid.",
  },
};
