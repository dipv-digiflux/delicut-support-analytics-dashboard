export function normalizeText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

/** Extract readable text from Chat-Transcript message_parts JSON. */
export function textFromMessageParts(raw: unknown): { text: string; hasAttachment: boolean } {
  if (raw == null || raw === "") return { text: "", hasAttachment: false };

  let parts: unknown = raw;
  if (typeof raw === "string") {
    try {
      parts = JSON.parse(raw);
    } catch {
      return { text: normalizeText(raw), hasAttachment: false };
    }
  }

  if (!Array.isArray(parts)) {
    return { text: normalizeText(parts), hasAttachment: false };
  }

  const texts: string[] = [];
  let hasAttachment = false;

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    if (p.text && typeof p.text === "object") {
      const t = (p.text as Record<string, unknown>).content;
      if (t != null) texts.push(String(t));
    } else if (typeof p.text === "string") {
      texts.push(p.text);
    }
    if (p.image || p.file || p.video || p.audio) hasAttachment = true;
  }

  return { text: normalizeText(texts.join("\n")), hasAttachment };
}
