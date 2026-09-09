"use client";

import { useEffect, useId, useState } from "react";

export function RawJsonButton({
  data,
  label = "Raw",
  className = "",
}: {
  data: unknown;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] ${className}`}
      >
        {label}
      </button>
      {open && <RawJsonModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RawJsonModal({
  data,
  onClose,
  title = "Raw JSON",
}: {
  data: unknown;
  onClose: () => void;
  title?: string;
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
        <pre className="flex-1 overflow-auto bg-[#0f172a] p-4 text-xs leading-relaxed text-slate-100">
          {text}
        </pre>
      </aside>
    </div>
  );
}
