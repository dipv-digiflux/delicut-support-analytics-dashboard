import { FreshchatError } from "@/lib/freshchat/errors";

const NAMED: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  happy: 5,
  unhappy: 1,
  neutral: 3,
  satisfied: 5,
  dissatisfied: 1,
  good: 5,
  bad: 1,
  excellent: 5,
  poor: 1,
};

/** Normalize CSAT to 1–5. Fail loud on unknown values. */
export function normalizeCsatRating(raw: unknown): {
  rating: number | null;
  rating_raw: string | null;
} {
  if (raw == null || raw === "") {
    return { rating: null, rating_raw: null };
  }

  const rating_raw = String(raw).trim();
  const asNum = Number(rating_raw);
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum <= 5) {
    // Freshchat sometimes uses 0–5; treat 0 as unrated-ish null? Keep 0 mapped null.
    if (asNum === 0) return { rating: null, rating_raw };
    return { rating: Math.round(asNum), rating_raw };
  }

  const mapped = NAMED[rating_raw.toLowerCase()];
  if (mapped != null) return { rating: mapped, rating_raw };

  throw new FreshchatError(
    `Unmapped CSAT rating value: ${JSON.stringify(raw)}`,
    "CSAT_RATING_UNMAPPED",
  );
}
