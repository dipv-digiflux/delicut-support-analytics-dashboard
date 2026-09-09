import { getConfig } from "@/lib/config";
import { parseFilters, defaultDateRange } from "@/lib/filters";

/** Parse URL filters with env-driven default date range + page size. */
export function filtersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const cfg = getConfig();
  const defaults = defaultDateRange(cfg.DASHBOARD_DEFAULT_RANGE_DAYS);

  if (sp instanceof URLSearchParams) {
    const next = new URLSearchParams(sp.toString());
    if (!next.get("from")) next.set("from", defaults.from);
    if (!next.get("to")) next.set("to", defaults.to);
    if (!next.get("limit")) next.set("limit", String(cfg.UI_DEFAULT_PAGE_SIZE));
    return parseFilters(next);
  }

  return parseFilters({
    ...sp,
    from: sp.from || defaults.from,
    to: sp.to || defaults.to,
    limit: sp.limit || String(cfg.UI_DEFAULT_PAGE_SIZE),
  });
}
