"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  limit,
  limits = [10, 20, 25, 50, 100],
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  limits?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const from = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalItems);

  const pages = useMemo(() => {
    const out: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [page, totalPages]);

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => next.set(k, v));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
      <div>
        Showing {from} to {to} of {totalItems.toLocaleString()} entries
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>Records per page</span>
          <select
            className="rounded border border-[var(--border)] bg-white px-2 py-1"
            value={limit}
            onChange={(e) => go({ limit: e.target.value, page: "1" })}
          >
            {limits.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="dc-page-btn"
            disabled={page <= 1}
            onClick={() => go({ page: String(page - 1) })}
          >
            ‹
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className="dc-page-btn"
              data-active={p === page}
              onClick={() => go({ page: String(p) })}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="dc-page-btn"
            disabled={page >= totalPages}
            onClick={() => go({ page: String(page + 1) })}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
