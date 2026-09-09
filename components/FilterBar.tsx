"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function FilterBar({ showSearch = false }: { showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      if (key !== "page") next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, sp],
  );

  const clear = () => {
    startTransition(() => router.push(pathname));
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <Field label="From">
        <input
          type="date"
          className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          defaultValue={sp.get("from") || ""}
          onChange={(e) => update("from", e.target.value)}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          className="rounded border border-slate-200 px-2 py-1.5 text-sm"
          defaultValue={sp.get("to") || ""}
          onChange={(e) => update("to", e.target.value)}
        />
      </Field>
      <Field label="Subject">
        <input
          className="w-36 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="all / unclassified"
          defaultValue={sp.get("subject") || ""}
          onBlur={(e) => update("subject", e.target.value.trim())}
        />
      </Field>
      <Field label="Agent ID">
        <input
          className="w-36 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="all / unassigned"
          defaultValue={sp.get("agent") || ""}
          onBlur={(e) => update("agent", e.target.value.trim())}
        />
      </Field>
      <Field label="Channel">
        <input
          className="w-36 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="exact channel name"
          defaultValue={sp.get("channel") || ""}
          onBlur={(e) => update("channel", e.target.value.trim())}
        />
      </Field>
      <Field label="Group">
        <input
          className="w-32 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="group name"
          defaultValue={sp.get("group") || ""}
          onBlur={(e) => update("group", e.target.value.trim())}
        />
      </Field>
      <Field label="Resolved">
        <select
          className="rounded border border-slate-200 px-2 py-1.5 text-sm"
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
          className="rounded border border-slate-200 px-2 py-1.5 text-sm"
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
            className="w-48 rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="id, agent, text…"
            defaultValue={sp.get("q") || ""}
            onBlur={(e) => update("q", e.target.value.trim())}
          />
        </Field>
      )}
      <button
        type="button"
        onClick={clear}
        className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Clear
      </button>
      {pending && (
        <span className="text-xs text-slate-400">Updating…</span>
      )}
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
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      {children}
    </label>
  );
}
