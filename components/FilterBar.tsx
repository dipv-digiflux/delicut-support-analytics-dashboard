"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { SearchableMultiSelect } from "@/components/filters/SearchableMultiSelect";

export function FilterBar({ showSearch = false }: { showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const agents = useMemo(() => sp.getAll("agent").filter(Boolean), [sp]);
  const users = useMemo(() => sp.getAll("user").filter(Boolean), [sp]);

  const push = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(sp.toString());
      mutate(next);
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, sp],
  );

  const update = (key: string, value: string) => {
    push((next) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
  };

  const setMulti = (key: string, ids: string[]) => {
    push((next) => {
      next.delete(key);
      for (const id of ids) next.append(key, id);
    });
  };

  const clear = () => startTransition(() => router.push(pathname));

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <input
            type="date"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            defaultValue={sp.get("from") || ""}
            onChange={(e) => update("from", e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            defaultValue={sp.get("to") || ""}
            onChange={(e) => update("to", e.target.value)}
          />
        </Field>

        <SearchableMultiSelect
          label="Responders"
          endpoint="/api/directories/agents"
          paramKey="agent"
          selected={agents}
          onChange={(ids) => setMulti("agent", ids)}
          placeholder="Search agents…"
        />
        <SearchableMultiSelect
          label="Customers"
          endpoint="/api/directories/customers"
          paramKey="user"
          selected={users}
          onChange={(ids) => setMulti("user", ids)}
          placeholder="Search customers…"
        />

        <Field label="Subject">
          <input
            className="w-36 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="label / unclassified"
            defaultValue={sp.get("subject") || ""}
            onBlur={(e) => update("subject", e.target.value.trim())}
          />
        </Field>
        <Field label="Channel">
          <input
            className="w-36 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="channel name"
            defaultValue={sp.get("channel") || ""}
            onBlur={(e) => update("channel", e.target.value.trim())}
          />
        </Field>
        <Field label="Group">
          <input
            className="w-32 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            placeholder="group"
            defaultValue={sp.get("group") || ""}
            onBlur={(e) => update("group", e.target.value.trim())}
          />
        </Field>
        <Field label="Resolved">
          <select
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            defaultValue={sp.get("resolved") || ""}
            onChange={(e) => update("resolved", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Resolved</option>
            <option value="false">Open</option>
          </select>
        </Field>
        <Field label="CSAT">
          <select
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
            defaultValue={sp.get("csat") || ""}
            onChange={(e) => update("csat", e.target.value)}
          >
            <option value="">All</option>
            <option value="rated">Rated</option>
            <option value="unrated">Unrated</option>
            <option value="satisfied">Satisfied (≥4)</option>
            <option value="dissatisfied">Dissatisfied (≤2)</option>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
        </Field>
        {showSearch && (
          <Field label="Search">
            <input
              className="w-48 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
              placeholder="id, text…"
              defaultValue={sp.get("q") || ""}
              onBlur={(e) => update("q", e.target.value.trim())}
            />
          </Field>
        )}
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--brand-50)]"
        >
          Clear
        </button>
        {pending && (
          <span className="text-xs text-[var(--muted)]">Updating…</span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-[var(--muted)]">{label}</div>
      {children}
    </label>
  );
}
