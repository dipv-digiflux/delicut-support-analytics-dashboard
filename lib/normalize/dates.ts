export function parseUtcDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value).trim();
  // Freshchat sometimes emits "YYYY-MM-DD HH:mm:ss.S"
  const normalized = s.includes("T") ? s : s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const d2 = new Date(s);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  return d;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function addUtcHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3600_000);
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}
