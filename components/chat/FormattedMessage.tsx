"use client";

import { sanitizeMessageHtml } from "@/lib/display/html";

export function FormattedMessage({ text }: { text: string }) {
  if (!text) return null;
  const html = sanitizeMessageHtml(text);
  return (
    <div
      className="break-words text-sm leading-relaxed [&_b]:font-semibold [&_strong]:font-semibold [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
