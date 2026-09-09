export function normalizeText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export {
  parseMessageParts,
  textFromMessageParts,
  type EmbeddedAttachment,
  type AttachmentKind,
} from "./message-parts";
