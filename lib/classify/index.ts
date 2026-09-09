import { getConfig } from "@/lib/config";
import type { Conversation, SubjectSource } from "@/lib/db/types";
import { isNoiseLabel, mapResolutionLabel } from "./label-map";
import { TAXONOMY } from "./taxonomy";

export interface ClassificationResult {
  subject: string;
  subject_source: SubjectSource;
  confidence: number;
  matched_keywords: string[];
  classifier_version: string;
  classified_at: Date;
}

export function classifyConversation(
  conv: Pick<Conversation, "messages" | "resolution" | "is_stub">,
): ClassificationResult {
  const cfg = getConfig();
  const version = cfg.CLASSIFIER_VERSION;
  const now = new Date();

  if (conv.is_stub) {
    return {
      subject: "unclassified",
      subject_source: "none",
      confidence: 0,
      matched_keywords: [],
      classifier_version: version,
      classified_at: now,
    };
  }

  const label = conv.resolution?.label;
  if (label && !isNoiseLabel(label)) {
    return {
      subject: mapResolutionLabel(label),
      subject_source: "resolution_label",
      confidence: 1,
      matched_keywords: [],
      classifier_version: version,
      classified_at: now,
    };
  }

  const userTexts = conv.messages
    .filter((m) => m.actor_type === "user")
    .slice(0, cfg.CLASSIFY_MESSAGE_WINDOW)
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();

  if (!userTexts.trim()) {
    return {
      subject: "unclassified",
      subject_source: "none",
      confidence: 0,
      matched_keywords: [],
      classifier_version: version,
      classified_at: now,
    };
  }

  const scores: { key: string; score: number; matched: string[] }[] = [];

  for (const entry of TAXONOMY) {
    if (entry.negative?.some((re) => re.test(userTexts))) continue;
    let score = 0;
    const matched: string[] = [];
    for (const p of entry.patterns) {
      if (p.re.test(userTexts)) {
        score += p.weight;
        matched.push(p.re.source);
      }
    }
    if (score > 0) scores.push({ key: entry.key, score, matched });
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];

  if (
    top &&
    top.score >= cfg.CLASSIFY_MIN_SCORE &&
    (!second || top.score >= 1.5 * second.score)
  ) {
    return {
      subject: top.key,
      subject_source: "keyword",
      confidence: Math.min(1, top.score / 6),
      matched_keywords: top.matched,
      classifier_version: version,
      classified_at: now,
    };
  }

  return {
    subject: "unclassified",
    subject_source: "none",
    confidence: 0,
    matched_keywords: [],
    classifier_version: version,
    classified_at: now,
  };
}
