export function fmtInt(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function fmtNum(n?: number | null, digits = 2) {
  if (n == null) return "—";
  return n.toFixed(digits);
}

export function fmtPct(n?: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
