import type { ConversationFilters } from "@/lib/filters";
import { filtersToQuery } from "@/lib/filters";

/** Map chart/table subject labels to the FilterBar `subject` query value. */
export function subjectFilterValue(subject: string | null | undefined): string {
  const s = (subject || "").trim();
  if (
    !s ||
    s === "(no Freshchat label)" ||
    s === "unlabeled" ||
    s === "unclassified"
  ) {
    return "unlabeled";
  }
  return s;
}

/** Build `/conversations?...` from current dashboard filters + a dimension patch. */
export function conversationsHref(
  filters: ConversationFilters,
  patch: Record<string, string | null | undefined> = {},
): string {
  const qs = new URLSearchParams(filtersToQuery(filters));
  qs.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") qs.delete(key);
    else qs.set(key, value);
  }
  return `/conversations?${qs.toString()}`;
}

/** Same helper when the dashboard already serialized the query string. */
export function conversationsHrefFromQuery(
  baseQuery: string,
  patch: Record<string, string | null | undefined> = {},
): string {
  const qs = new URLSearchParams(baseQuery);
  qs.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    // Multi-value keys: replace entirely
    if (key === "agent" || key === "user" || key === "channelId") {
      qs.delete(key);
      if (value != null && value !== "") qs.append(key, value);
      continue;
    }
    if (value == null || value === "") qs.delete(key);
    else qs.set(key, value);
  }
  return `/conversations?${qs.toString()}`;
}
