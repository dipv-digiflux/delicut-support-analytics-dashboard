"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DirectoryOption {
  id: string;
  name: string;
  email?: string | null;
  secondary?: string | null;
}

export function SearchableMultiSelect({
  label,
  endpoint,
  paramKey,
  selected,
  onChange,
  placeholder = "Search…",
}: {
  label: string;
  endpoint: string;
  paramKey: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(query)}&limit=30`,
        );
        const json = await res.json();
        const items = (json.data?.items || []) as DirectoryOption[];
        setOptions(items);
        setLabels((prev) => {
          const next = { ...prev };
          for (const i of items) next[i.id] = i.name;
          return next;
        });
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(q), 200);
    return () => clearTimeout(t);
  }, [q, open, load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (id: string, name: string) => {
    setLabels((p) => ({ ...p, [id]: name }));
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="relative min-w-[180px]" ref={boxRef}>
      <div className="mb-1 text-xs font-medium text-[var(--muted)]">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-left text-sm"
      >
        <span className="truncate text-[var(--foreground)]">
          {selected.length === 0
            ? "All"
            : selected.map((id) => labels[id] || id.slice(0, 8)).join(", ")}
        </span>
        <span className="ml-2 text-[var(--muted)]">▾</span>
      </button>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(selected.filter((x) => x !== id))}
              className="rounded-full bg-[var(--brand-100)] px-2 py-0.5 text-[11px] text-[var(--brand-800)]"
            >
              {(labels[id] || id).slice(0, 24)} ×
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-xl border border-[var(--border)] bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="mb-2 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto text-sm">
            {loading && (
              <div className="px-2 py-2 text-[var(--muted)]">Loading…</div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-2 py-2 text-[var(--muted)]">No matches</div>
            )}
            {options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id, o.name)}
                  className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-[var(--brand-50)] ${
                    on ? "bg-[var(--brand-50)]" : ""
                  }`}
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="truncate font-mono text-[10px] text-[var(--muted)]">
                    {o.email || o.id}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="sr-only">{paramKey}</div>
        </div>
      )}
    </div>
  );
}
