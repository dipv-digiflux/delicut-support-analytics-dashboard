import { normalizeText } from "./text";

export type AttachmentKind = "image" | "file" | "video" | "audio" | "unknown";

export interface EmbeddedAttachment {
  kind: AttachmentKind;
  url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  raw: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseMediaBlob(
  kind: AttachmentKind,
  blob: unknown,
): EmbeddedAttachment | null {
  const r = asRecord(blob);
  if (!r) return null;
  return {
    kind,
    url: str(r.url ?? r.media_url ?? r.src ?? r.content),
    thumbnail_url: str(
      (asRecord(r.thumbnail)?.url as unknown) ??
        r.thumbnail_url ??
        r.preview_url,
    ),
    file_name: str(r.name ?? r.file_name ?? r.filename),
    mime_type: str(r.content_type ?? r.mime_type ?? r.type),
    size_bytes: num(r.file_size ?? r.size ?? r.size_bytes),
    width: num(r.width),
    height: num(r.height),
    duration_seconds: num(r.duration ?? r.duration_seconds),
    raw: r,
  };
}

/** Extract text + structured attachments from Freshchat message_parts JSON. */
export function parseMessageParts(raw: unknown): {
  text: string;
  hasAttachment: boolean;
  attachments: EmbeddedAttachment[];
} {
  if (raw == null || raw === "") {
    return { text: "", hasAttachment: false, attachments: [] };
  }

  let parts: unknown = raw;
  if (typeof raw === "string") {
    try {
      parts = JSON.parse(raw);
    } catch {
      return {
        text: normalizeText(raw),
        hasAttachment: false,
        attachments: [],
      };
    }
  }

  if (!Array.isArray(parts)) {
    return {
      text: normalizeText(parts),
      hasAttachment: false,
      attachments: [],
    };
  }

  const texts: string[] = [];
  const attachments: EmbeddedAttachment[] = [];

  for (const part of parts) {
    const p = asRecord(part);
    if (!p) continue;

    if (p.text && typeof p.text === "object") {
      const t = (p.text as Record<string, unknown>).content;
      if (t != null) texts.push(String(t));
    } else if (typeof p.text === "string") {
      texts.push(p.text);
    }

    for (const kind of ["image", "file", "video", "audio"] as const) {
      if (p[kind]) {
        const att = parseMediaBlob(kind, p[kind]);
        if (att) attachments.push(att);
      }
    }
  }

  return {
    text: normalizeText(texts.join("\n")),
    hasAttachment: attachments.length > 0,
    attachments,
  };
}

/** @deprecated Prefer parseMessageParts — kept for call-site compatibility. */
export function textFromMessageParts(raw: unknown): {
  text: string;
  hasAttachment: boolean;
} {
  const r = parseMessageParts(raw);
  return { text: r.text, hasAttachment: r.hasAttachment };
}
