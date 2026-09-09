import { getConfig } from "@/lib/config";
import { parseFilters, defaultDateRange } from "@/lib/filters";
import { resolveTimeZone } from "@/lib/timezone";

/** Parse URL filters with env-driven defaults + timezone (tz query / config). */
export function filtersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  const cfg = getConfig();
  const defaults = defaultDateRange(cfg.DASHBOARD_DEFAULT_RANGE_DAYS);
  const defaultTz = resolveTimeZone(cfg.REPORTING_TIMEZONE);

  if (sp instanceof URLSearchParams) {
    const next = new URLSearchParams(sp.toString());
    if (!next.get("from")) next.set("from", defaults.from);
    if (!next.get("to")) next.set("to", defaults.to);
    if (!next.get("limit")) next.set("limit", String(cfg.UI_DEFAULT_PAGE_SIZE));
    if (!next.get("tz")) next.set("tz", defaultTz);
    return parseFilters(next);
  }

  return parseFilters({
    ...sp,
    from: sp.from || defaults.from,
    to: sp.to || defaults.to,
    limit: sp.limit || String(cfg.UI_DEFAULT_PAGE_SIZE),
    tz: (typeof sp.tz === "string" ? sp.tz : sp.tz?.[0]) || defaultTz,
  });
}
