export const NOISE_LABELS = new Set(
  ["", "other", "others", "n/a", "na", "-", "test", "none", "unclassified"].map(
    (s) => s.toLowerCase(),
  ),
);

export function isNoiseLabel(label: string | null | undefined): boolean {
  if (label == null) return true;
  return NOISE_LABELS.has(label.trim().toLowerCase());
}

/** Map Freshchat resolution labels to taxonomy keys when known. */
export const LABEL_MAP: Record<string, string> = {
  billing: "billing",
  "billing issue": "billing",
  refund: "billing.refund",
  "refund request": "billing.refund",
  shipping: "shipping",
  delivery: "shipping",
  "order status": "orders.status",
  "order issue": "orders",
  technical: "technical",
  "tech support": "technical",
  login: "account.login",
  account: "account",
  cancellation: "orders.cancel",
  complaint: "complaint",
  feedback: "feedback",
  general: "general",
  pause: "plan.pause",
  "pause plan": "plan.pause",
  skip: "plan.pause",
  "plan change": "plan.change",
  upgrade: "plan.change",
  downgrade: "plan.change",
  trial: "trial",
  quality: "quality",
  "food quality": "quality",
  missing: "missing",
  "wrong item": "missing",
  renew: "plan.renew",
  renewal: "plan.renew",
  promo: "promo",
  discount: "promo",
  address: "address",
  "delivery timing": "delivery.timing",
  bags: "bags",
  swap: "meal.swap",
};

export function mapResolutionLabel(label: string): string {
  const key = label.trim().toLowerCase();
  return LABEL_MAP[key] || label.trim();
}
