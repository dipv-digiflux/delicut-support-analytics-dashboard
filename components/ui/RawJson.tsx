"use client";

import { useEffect, useId, useState } from "react";

export function RawJsonButton({
  data,
  href,
  label = "Raw",
  className = "",
}: {
  data?: unknown;
  /** When set, fetch full JSON (e.g. conversation with all messages) on click. */
  href?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<unknown>(data ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPanel() {
    setError(null);
    if (href) {
      setLoading(true);
      setOpen(true);
      try {
        const res = await fetch(href);
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error?.message || `HTTP ${res.status}`);
          setPayload(json);
          return;
        }
        setPayload(json.data?.conversation ?? json.data ?? json);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    setPayload(data ?? null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openPanel()}
        className={`rounded border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] ${className}`}
      >
        {label}
      </button>
      {open && (
        <RawJsonModal
          data={payload}
          loading={loading}
          error={error}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function RawJsonModal({
  data,
  onClose,
  title = "Raw JSON",
  loading = false,
  error = null,
}: {
  data: unknown;
  onClose: () => void;
  title?: string;
  loading?: boolean;
  error?: string | null;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const text = JSON.stringify(data, null, 2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-[var(--border)] px-2 py-1 text-xs"
              onClick={() => navigator.clipboard.writeText(text)}
              disabled={loading}
            >
              Copy
            </button>
            <button
              type="button"
              className="rounded bg-[var(--brand)] px-2 py-1 text-xs text-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex-1 p-4 text-sm text-[var(--muted)]">Loading full document…</div>
        ) : (
          <pre className="flex-1 overflow-auto bg-[#0f172a] p-4 text-xs leading-relaxed text-slate-100">
            {text}
          </pre>
        )}
      </aside>
    </div>
  );
}
