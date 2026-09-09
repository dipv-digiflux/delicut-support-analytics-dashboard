"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DirectoryOption {
  id: string;
  name: string;
  email?: string | null;
  secondary?: string | null;
}

const PAGE_SIZE = 40;

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedKey = selected.join("|");
  const requestId = useRef(0);

  const mergeLabels = (items: DirectoryOption[]) => {
    setLabels((prev) => {
      const next = { ...prev };
      for (const i of items) next[i.id] = i.name;
      return next;
    });
  };

  const loadPage = useCallback(
    async (query: string, pageNum: number, append: boolean) => {
      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&page=${pageNum}`,
        );
        const json = await res.json();
        if (id !== requestId.current) return;
        const items = (json.data?.items || []) as DirectoryOption[];
        const more = Boolean(json.data?.hasMore);
        const tot = Number(json.data?.total || items.length);
        setHasMore(more);
        setTotal(tot);
        setPage(pageNum);
        setOptions((prev) => {
          if (!append) return items;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...items.filter((i) => !seen.has(i.id))];
        });
        mergeLabels(items);
      } catch {
        if (id !== requestId.current) return;
        if (!append) setOptions([]);
        setHasMore(false);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [endpoint],
  );

  // Resolve chip labels for already-selected ids
  useEffect(() => {
    if (!selected.length) return;
    const missing = selected.filter((id) => !labels[id]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${endpoint}?ids=${encodeURIComponent(missing.join(","))}`,
        );
        const json = await res.json();
        const items = (json.data?.items || []) as DirectoryOption[];
        if (cancelled) return;
        mergeLabels(items);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally omit labels — only re-fetch when selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, selectedKey]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setOptions([]);
      setPage(1);
      setHasMore(false);
      void loadPage(q, 1, false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, loadPage]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onScroll = () => {
    const el = listRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom) void loadPage(q, page + 1, true);
  };

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
            : selected.length === 1
              ? labels[selected[0]!] || selected[0]!.slice(0, 12)
              : `${selected.length} selected`}
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
              className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] text-[var(--brand)]"
            >
              {(labels[id] || id).slice(0, 28)} ×
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-80 rounded-xl border border-[var(--border)] bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="mb-2 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div
            ref={listRef}
            onScroll={onScroll}
            className="max-h-56 overflow-y-auto text-sm"
          >
            {loading && options.length === 0 && (
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
                  className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-[var(--brand-soft)] ${
                    on ? "bg-[var(--brand-soft)]" : ""
                  }`}
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="truncate text-[10px] text-[var(--muted)]">
                    {o.secondary || o.email || o.id}
                  </span>
                </button>
              );
            })}
            {loadingMore && (
              <div className="px-2 py-2 text-center text-[11px] text-[var(--muted)]">
                Loading more…
              </div>
            )}
            {!loadingMore && hasMore && (
              <button
                type="button"
                onClick={() => void loadPage(q, page + 1, true)}
                className="w-full px-2 py-2 text-center text-[11px] font-medium text-[var(--brand)] hover:underline"
              >
                Load more
              </button>
            )}
          </div>
          {total > 0 && (
            <div className="mt-1 border-t border-[var(--border)] px-1 pt-1 text-[10px] text-[var(--muted)]">
              Showing {options.length}
              {total > options.length ? ` of ${total}` : ""}
              {hasMore ? " · scroll for more" : ""}
            </div>
          )}
          <div className="sr-only">{paramKey}</div>
        </div>
      )}
    </div>
  );
}
