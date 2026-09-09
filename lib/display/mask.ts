/** Mask phone / WhatsApp / IG-style identifiers for list views. */
export function maskContact(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const v = value.trim();

  // Instagram-style handle
  if (v.startsWith("@") || (!v.includes("+") && /^[a-z0-9._]+$/i.test(v) && !/^\d+$/.test(v))) {
    const handle = v.replace(/^@/, "");
    if (handle.length <= 4) return `@${handle}`;
    return `@${handle.slice(0, 2)}…${handle.slice(-2)}`;
  }

  // Digits / E.164
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 7) {
    const prefix = v.startsWith("+") ? "+" : "";
    const country = digits.length > 10 ? digits.slice(0, digits.length - 10) : "";
    const last4 = digits.slice(-4);
    return `${prefix}${country}${country ? " " : ""}••• ••• ${last4}`;
  }

  if (v.length <= 6) return v;
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return "—";
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] || ""}${parts[parts.length - 1]![0] || ""}`.toUpperCase();
}

/** Deterministic pastel from id/name for avatar backgrounds */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 45% 42%)`;
}
