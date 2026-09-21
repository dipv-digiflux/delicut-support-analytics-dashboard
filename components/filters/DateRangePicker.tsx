"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== m - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function formatDisplay(ymd: string): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function inRange(day: string, from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  return compareYmd(day, from) >= 0 && compareYmd(day, to) <= 0;
}

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(from || null);
  const [draftTo, setDraftTo] = useState<string | null>(to || null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(parseYmd(from) || parseYmd(to) || new Date()),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from || null);
    setDraftTo(to || null);
    setHoverDay(null);
    setViewMonth(startOfMonth(parseYmd(from) || parseYmd(to) || new Date()));
  }, [open, from, to]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const previewTo = useMemo(() => {
    if (draftFrom && !draftTo && hoverDay) {
      return compareYmd(hoverDay, draftFrom) < 0 ? draftFrom : hoverDay;
    }
    return draftTo;
  }, [draftFrom, draftTo, hoverDay]);

  const previewFrom = useMemo(() => {
    if (draftFrom && !draftTo && hoverDay && compareYmd(hoverDay, draftFrom) < 0) {
      return hoverDay;
    }
    return draftFrom;
  }, [draftFrom, draftTo, hoverDay]);

  const label =
    from && to
      ? `${formatDisplay(from)} – ${formatDisplay(to)}`
      : from
        ? `${formatDisplay(from)} – …`
        : "Select date range";

  const cells = useMemo(() => {
    const firstDow = viewMonth.getDay();
    const total = daysInMonth(viewMonth);
    const out: Array<{ ymd: string | null; label: number | null }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ ymd: null, label: null });
    for (let day = 1; day <= total; day++) {
      const ymd = `${viewMonth.getFullYear()}-${pad2(viewMonth.getMonth() + 1)}-${pad2(day)}`;
      out.push({ ymd, label: day });
    }
    while (out.length % 7 !== 0) out.push({ ymd: null, label: null });
    return out;
  }, [viewMonth]);

  const pick = (ymd: string) => {
    if (!draftFrom || draftTo) {
      setDraftFrom(ymd);
      setDraftTo(null);
      setHoverDay(null);
      return;
    }
    let nextFrom = draftFrom;
    let nextTo = ymd;
    if (compareYmd(ymd, draftFrom) < 0) {
      nextFrom = ymd;
      nextTo = draftFrom;
    }
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    onChange({ from: nextFrom, to: nextTo });
    setOpen(false);
  };

  const applyPreset = (days: number) => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const next = { from: toYmd(start), to: toYmd(end) };
    onChange(next);
    setOpen(false);
  };

  const monthTitle = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative block" ref={boxRef}>
      <div className="mb-1 text-xs font-medium text-[var(--muted)]">
        Date range
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[220px] items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-left text-sm hover:border-[var(--brand)]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={from && to ? "" : "text-[var(--muted)]"}>{label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-[var(--muted)]"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute left-0 z-40 mt-1 w-[280px] rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {[
              { label: "7d", days: 7 },
              { label: "14d", days: 14 },
              { label: "30d", days: 30 },
              { label: "90d", days: 90 },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--brand-soft)]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="text-sm font-semibold">{monthTitle}</div>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--brand-soft)]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-[var(--muted)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (!cell.ymd) {
                return <div key={`e-${i}`} className="h-8" />;
              }
              const ymd = cell.ymd;
              const isStart = previewFrom === ymd;
              const isEnd = previewTo === ymd;
              const isEdge = isStart || isEnd;
              const mid = inRange(ymd, previewFrom, previewTo) && !isEdge;
              const selecting = Boolean(draftFrom && !draftTo);

              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => pick(ymd)}
                  onMouseEnter={() => selecting && setHoverDay(ymd)}
                  onMouseLeave={() => selecting && setHoverDay(null)}
                  className={[
                    "h-8 rounded-md text-xs transition",
                    isEdge
                      ? "bg-[var(--brand)] font-semibold text-white"
                      : mid
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "hover:bg-[var(--brand-soft)]",
                  ].join(" ")}
                >
                  {cell.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {draftFrom && !draftTo
              ? "Click end date to finish range"
              : "Click start date, then end date"}
          </p>
        </div>
      )}
    </div>
  );
}
