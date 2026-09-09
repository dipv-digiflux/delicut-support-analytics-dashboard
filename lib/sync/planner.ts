import { getConfig } from "@/lib/config";
import type { ExtractEvent, SyncWindow } from "@/lib/db/types";
import {
  startOfUtcDay,
  addUtcDays,
  minDate,
} from "@/lib/normalize/dates";

export function windowId(
  event: ExtractEvent,
  start: Date,
  end: Date,
): string {
  return `${event}|${start.toISOString()}|${end.toISOString()}`;
}

export interface PlannedWindow {
  _id: string;
  event: ExtractEvent;
  window_start: Date;
  window_end: Date;
  is_hot: boolean;
}

/** Plan aligned windows covering [from, until). */
export function planWindows(opts: {
  event: ExtractEvent;
  from: Date;
  until: Date;
  now?: Date;
}): PlannedWindow[] {
  const now = opts.now ?? new Date();
  const until = minDate(opts.until, now);
  if (opts.from >= until) return [];

  if (opts.event === "Chat-Transcript") {
    return planTranscriptDays(opts.from, until, now);
  }
  return planMonthlyOrSlice(opts.event, opts.from, until, now);
}

function planTranscriptDays(
  from: Date,
  until: Date,
  now: Date,
): PlannedWindow[] {
  const out: PlannedWindow[] = [];
  let cursor = startOfUtcDay(from);
  const endBound = until;

  while (cursor < endBound) {
    const next = addUtcDays(cursor, 1);
    const windowEnd = minDate(next, endBound);
    const isHot = startOfUtcDay(cursor).getTime() === startOfUtcDay(now).getTime();
    // Stable id uses day-aligned end for hot windows
    const idEnd = isHot ? next : windowEnd;
    const start = cursor;
    const end = isHot ? minDate(next, now) : windowEnd;
    if (start < end) {
      out.push({
        _id: windowId("Chat-Transcript", start, isHot ? next : end),
        event: "Chat-Transcript",
        window_start: start,
        window_end: end,
        is_hot: isHot,
      });
    }
    cursor = next;
  }
  return out;
}

function planMonthlyOrSlice(
  event: ExtractEvent,
  from: Date,
  until: Date,
  now: Date,
): PlannedWindow[] {
  const out: PlannedWindow[] = [];
  // Prefer contiguous day-aligned slices of up to 28 days for simplicity & stability
  let cursor = startOfUtcDay(from);
  const maxSpanDays = 28;

  while (cursor < until) {
    const next = addUtcDays(cursor, maxSpanDays);
    const windowEnd = minDate(next, until);
    const isHot = windowEnd.getTime() >= startOfUtcDay(now).getTime();
    const end = isHot ? minDate(windowEnd, now) : windowEnd;
    if (cursor < end) {
      const idEnd = isHot
        ? minDate(next, addUtcDays(startOfUtcDay(now), 1))
        : end;
      out.push({
        _id: windowId(event, cursor, idEnd),
        event,
        window_start: cursor,
        window_end: end,
        is_hot: isHot,
      });
    }
    cursor = next;
  }
  return out;
}

export function overlapFor(event: ExtractEvent): {
  value: number;
  unit: "hours" | "days";
} {
  const cfg = getConfig();
  if (event === "Chat-Transcript") {
    return { value: cfg.SYNC_TRANSCRIPT_OVERLAP_HOURS, unit: "hours" };
  }
  if (event === "CSAT-Score") {
    return { value: cfg.SYNC_CSAT_OVERLAP_DAYS, unit: "days" };
  }
  return { value: cfg.SYNC_LABEL_OVERLAP_DAYS, unit: "days" };
}

export function applyOverlap(from: Date, event: ExtractEvent): Date {
  const o = overlapFor(event);
  if (o.unit === "hours") {
    return new Date(from.getTime() - o.value * 3600_000);
  }
  return addUtcDays(from, -o.value);
}

export function needsFetch(window: SyncWindow, force = false): boolean {
  if (force) return true;
  if (window.is_hot) return true;
  if (window.status === "failed") return true;
  if (window.status === "submitted" || window.status === "ready") return true;
  if (window.status === "planned") return true;
  return false; // merged / skipped
}
