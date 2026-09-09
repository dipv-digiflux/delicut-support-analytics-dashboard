"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** Clickable table header that toggles ?sort=&order= in the URL. */
export function SortHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
}: {
  label: string;
  /** URL `sort` value — omit for non-sortable columns */
  sortKey?: string;
  currentSort: string;
  currentOrder: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!sortKey) {
    return <span>{label}</span>;
  }

  const active = currentSort === sortKey;
  const nextOrder: "asc" | "desc" =
    active && currentOrder === "desc" ? "asc" : "desc";

  const onClick = () => {
    const next = new URLSearchParams(sp.toString());
    next.set("sort", sortKey);
    next.set("order", active ? nextOrder : "desc");
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-[var(--brand)] ${
        active ? "text-[var(--brand-ink)]" : ""
      }`}
      title={`Sort by ${label}`}
    >
      {label}
      <span className="text-[10px] text-[var(--muted)]" aria-hidden>
        {active ? (currentOrder === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}
