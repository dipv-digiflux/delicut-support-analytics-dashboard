export type ChannelKind = "whatsapp" | "instagram" | "phone" | "web" | "other";

export interface ParsedChannel {
  kind: ChannelKind;
  label: string;
  /** Phone / IG handle / line id extracted from channel_name */
  identity: string | null;
  raw: string | null;
}

/** Parse Freshchat channel names like WHATSAPP_+971…, IG_delicut.uae, Phone-ZIWO */
export function parseChannel(raw: string | null | undefined): ParsedChannel {
  if (!raw?.trim()) {
    return { kind: "other", label: "Unknown", identity: null, raw: null };
  }
  const s = raw.trim();
  const upper = s.toUpperCase();

  if (upper.startsWith("WHATSAPP_") || upper.startsWith("WHATSAPP-")) {
    const identity = s.replace(/^whatsapp[_-]/i, "").trim() || null;
    return { kind: "whatsapp", label: "WhatsApp", identity, raw: s };
  }
  if (upper.startsWith("IG_") || upper.startsWith("INSTAGRAM")) {
    const identity = s
      .replace(/^ig[_-]/i, "")
      .replace(/^instagram[_-]?/i, "")
      .trim()
      .replace(/^@/, "");
    return {
      kind: "instagram",
      label: "Instagram",
      identity: identity || null,
      raw: s,
    };
  }
  if (upper.startsWith("PHONE") || upper.includes("ZIWO") || upper.includes("VOICE")) {
    const identity = s.replace(/^phone[_-]*/i, "").trim() || null;
    return { kind: "phone", label: "Phone", identity, raw: s };
  }
  if (upper.includes("WEB") || upper.includes("WIDGET") || upper.includes("FB")) {
    return { kind: "web", label: "Web", identity: s, raw: s };
  }
  return { kind: "other", label: s, identity: null, raw: s };
}

export function channelTheme(kind: ChannelKind): {
  bg: string;
  /** Customer / inbound message bubble */
  userBubble: string;
  /** Agent / outbound message bubble */
  agentBubble: string;
  accent: string;
  badge: string;
} {
  switch (kind) {
    case "whatsapp":
      return {
        bg: "#e5ddd5",
        userBubble: "#ffffff",
        agentBubble: "#d9fdd3",
        accent: "#128c7e",
        badge: "bg-[#dcf8c6] text-[#075e54]",
      };
    case "instagram":
      return {
        bg: "#f3e8ff",
        userBubble: "#ffffff",
        agentBubble: "#e9d5ff",
        accent: "#a21caf",
        badge: "bg-fuchsia-100 text-fuchsia-800",
      };
    case "phone":
      return {
        bg: "#dbeafe",
        userBubble: "#ffffff",
        agentBubble: "#bfdbfe",
        accent: "#1d4ed8",
        badge: "bg-blue-100 text-blue-800",
      };
    case "web":
      return {
        bg: "#e2e8f0",
        userBubble: "#ffffff",
        agentBubble: "#cbd5e1",
        accent: "#334155",
        badge: "bg-slate-200 text-slate-700",
      };
    default:
      return {
        bg: "#f0f1f3",
        userBubble: "#ffffff",
        agentBubble: "#ffe4e6",
        accent: "#e31c23",
        badge: "bg-[var(--brand-soft)] text-[var(--brand)]",
      };
  }
}
