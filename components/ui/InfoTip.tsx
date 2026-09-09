"use client";

import { useId, useState } from "react";

/** Compact info tip — hover / focus / click for help text. */
export function InfoTip({
  text,
  label = "More info",
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[10px] font-bold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-1 w-56 -translate-x-1/2 rounded-lg bg-[#1f2937] px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1f2937]" />
        </span>
      )}
    </span>
  );
}
