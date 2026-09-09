/** Supported display + filter timezones (Delicut UAE default = Dubai). */
export const TIMEZONE_OPTIONS = [
  {
    id: "Asia/Dubai",
    label: "Dubai (GST)",
    short: "Dubai",
  },
  {
    id: "Asia/Kolkata",
    label: "India (IST)",
    short: "IST",
  },
  {
    id: "UTC",
    label: "UTC",
    short: "UTC",
  },
] as const;

export type AppTimeZone = (typeof TIMEZONE_OPTIONS)[number]["id"];

export const DEFAULT_TIMEZONE: AppTimeZone = "Asia/Dubai";
export const TZ_STORAGE_KEY = "delicut.timezone";

export function isAppTimeZone(v: string | null | undefined): v is AppTimeZone {
  return TIMEZONE_OPTIONS.some((o) => o.id === v);
}

export function resolveTimeZone(
  raw?: string | null,
  fallback: AppTimeZone = DEFAULT_TIMEZONE,
): AppTimeZone {
  if (raw && isAppTimeZone(raw)) return raw;
  return fallback;
}

export function timezoneLabel(tz: string): string {
  return TIMEZONE_OPTIONS.find((o) => o.id === tz)?.label || tz;
}

/** Format an instant for UI in the chosen timezone. */
export function formatInTimeZone(
  value: Date | string | null | undefined,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).format(d);
}

export function formatDateOnlyInTimeZone(
  value: Date | string | null | undefined,
  timeZone: string,
): string {
  return formatInTimeZone(value, timeZone, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** YYYY-MM-DD ± calendar days (UTC date arithmetic — fine for civil YMD strings). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convert a wall-clock date/time in `timeZone` to a UTC Date.
 * `ymd` is YYYY-MM-DD; optional h/m/s default to start of day.
 */
export function zonedWallTimeToUtc(
  ymd: string,
  timeZone: string,
  h = 0,
  mi = 0,
  s = 0,
  ms = 0,
): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let guess = Date.UTC(year, month - 1, day, h, mi, s, ms);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asUtcParts = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const wanted = Date.UTC(year, month - 1, day, h, mi, s, ms);
    guess = wanted - (asUtcParts - guess);
  }
  return new Date(guess);
}

/**
 * Inclusive calendar days from/to in `timeZone` → UTC Mongo range on created_at.
 * `to` is inclusive (range is [from 00:00, to+1day 00:00) in that zone).
 */
export function zonedDayRangeUtc(
  fromYmd: string | undefined,
  toYmd: string | undefined,
  timeZone: string,
): { $gte?: Date; $lt?: Date } {
  const range: { $gte?: Date; $lt?: Date } = {};
  if (fromYmd) {
    range.$gte = zonedWallTimeToUtc(fromYmd, timeZone, 0, 0, 0, 0);
  }
  if (toYmd) {
    range.$lt = zonedWallTimeToUtc(addDaysYmd(toYmd, 1), timeZone, 0, 0, 0, 0);
  }
  return range;
}
