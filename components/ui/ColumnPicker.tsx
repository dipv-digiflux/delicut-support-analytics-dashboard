"use client";

import { useEffect, useMemo, useState } from "react";

export type ColumnDef<Id extends string> = {
  id: Id;
  label: string;
  defaultOn: boolean;
};

export function useColumnVisibility<Id extends string>(
  storageKey: string,
  columns: readonly ColumnDef<Id>[],
) {
  const defaults = useMemo(
    () =>
      Object.fromEntries(columns.map((c) => [c.id, c.defaultOn])) as Record<
        Id,
        boolean
      >,
    [columns],
  );
  const [visible, setVisible] = useState<Record<Id, boolean>>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<Id, boolean>>;
        setVisible({ ...defaults, ...parsed });
      } else {
        setVisible(defaults);
      }
    } catch {
      setVisible(defaults);
    }
    setReady(true);
  }, [defaults, storageKey]);

  const persist = (next: Record<Id, boolean>) => {
    setVisible(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const cols = columns.filter((c) => visible[c.id]);

  return { visible, persist, cols, defaults, ready };
}

export function ColumnPicker<Id extends string>({
  columns,
  visible,
  defaults,
  onChange,
  buttonLabel = "Columns",
}: {
  columns: readonly ColumnDef<Id>[];
  visible: Record<Id, boolean>;
  defaults: Record<Id, boolean>;
  onChange: (next: Record<Id, boolean>) => void;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const onCount = columns.filter((c) => visible[c.id]).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:border-[var(--brand)]"
        onClick={() => setOpen((v) => !v)}
      >
        {buttonLabel} ({onCount}/{columns.length})
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close columns"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg">
            <div className="mb-1 flex gap-1 px-1">
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--brand)]"
                onClick={() =>
                  onChange(
                    Object.fromEntries(columns.map((c) => [c.id, true])) as Record<
                      Id,
                      boolean
                    >,
                  )
                }
              >
                All
              </button>
              <span className="text-[10px] text-[var(--muted)]">·</span>
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--muted)]"
                onClick={() => onChange(defaults)}
              >
                Defaults
              </button>
            </div>
            {columns.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--brand-soft)]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(visible[c.id])}
                  onChange={(e) =>
                    onChange({ ...visible, [c.id]: e.target.checked })
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
