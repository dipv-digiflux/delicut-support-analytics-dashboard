const ALLOWED = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "p",
  "span",
  "a",
  "ul",
  "ol",
  "li",
]);

/** Escape then re-allow a tiny safe HTML subset used in Freshchat agent replies. */
export function sanitizeMessageHtml(input: string): string {
  if (!input) return "";
  // Normalize common Freshchat quirks
  let s = input.replace(/\r\n/g, "\n").replace(/&nbsp;/gi, " ");

  // If no tags, escape and convert newlines
  if (!/<[a-z][\s\S]*>/i.test(s)) {
    return escapeHtml(s).replace(/\n/g, "<br/>");
  }

  // Strip dangerous tags/attrs via regex (messages are short; avoid heavy deps)
  s = s
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');

  // Drop tags not in allowlist
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return "";
    if (t === "br") return "<br/>";
    if (t === "a") {
      const href = full.match(/href\s*=\s*("|')(https?:\/\/[^"']+)\1/i);
      if (full.startsWith("</")) return "</a>";
      if (href) {
        return `<a href="${href[2]}" target="_blank" rel="noopener noreferrer" class="underline text-[var(--brand)]">`;
      }
      return "<span>";
    }
    if (full.startsWith("</")) return `</${t}>`;
    return `<${t}>`;
  });

  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}
