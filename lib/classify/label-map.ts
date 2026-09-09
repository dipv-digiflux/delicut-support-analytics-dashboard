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
};

export function mapResolutionLabel(label: string): string {
  const key = label.trim().toLowerCase();
  return LABEL_MAP[key] || label.trim();
}
