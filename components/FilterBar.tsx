"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { SearchableMultiSelect } from "@/components/filters/SearchableMultiSelect";
import {
  ColumnPicker,
  useColumnVisibility,
  type ColumnDef,
} from "@/components/ui/ColumnPicker";
import { InfoTip } from "@/components/ui/InfoTip";
import { SEARCH_COVERS, SEARCH_PLACEHOLDER } from "@/lib/search-labels";

const FILTER_STORAGE = "delicut.filters.visible.v1";

const FILTER_DEFS = [
  { id: "dates", label: "Date range", defaultOn: true },
  { id: "responders", label: "Responders", defaultOn: true },
  { id: "customers", label: "Customers", defaultOn: true },
  { id: "channel", label: "Channel", defaultOn: true },
  { id: "subject", label: "Subject / label", defaultOn: true },
  { id: "group", label: "Group", defaultOn: true },
  { id: "resolved", label: "Resolved", defaultOn: true },
  { id: "reopened", label: "Reopened", defaultOn: false },
  { id: "csat", label: "CSAT", defaultOn: true },
  { id: "search", label: "Search", defaultOn: true },
] as const satisfies readonly ColumnDef<string>[];

type FilterId = (typeof FILTER_DEFS)[number]["id"];

const ACTIVE_PARAM_KEYS = [
  "agent",
  "user",
  "channelId",
  "channel",
  "subject",
  "group",
  "resolved",
  "reopened",
  "csat",
  "q",
] as const;

export function FilterBar({
  showSearch = true,
  defaultCollapsed = false,
}: {
  showSearch?: boolean;
  /** Dashboard only: start collapsed; click Filters to expand. */
  defaultCollapsed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!defaultCollapsed);
  const qRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);

  const { visible, persist, defaults } = useColumnVisibility<FilterId>(
    FILTER_STORAGE,
    FILTER_DEFS,
  );

  const agents = useMemo(() => sp.getAll("agent").filter(Boolean), [sp]);
  const users = useMemo(() => sp.getAll("user").filter(Boolean), [sp]);
  const channels = useMemo(
    () => sp.getAll("channelId").filter(Boolean),
    [sp],
  );

  const activeCount = useMemo(() => {
    let n = 0;
    for (const key of ACTIVE_PARAM_KEYS) {
      n += sp.getAll(key).filter(Boolean).length;
    }
    return n;
  }, [sp]);

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

  const applySearch = () => {
    push((next) => {
      const q = qRef.current?.value.trim() || "";
      const subject = subjectRef.current?.value.trim() || "";
      const group = groupRef.current?.value.trim() || "";
      if (q) next.set("q", q);
      else next.delete("q");
      if (subject) next.set("subject", subject);
      else next.delete("subject");
      if (group) next.set("group", group);
      else next.delete("group");
    });
  };

  const clear = () => startTransition(() => router.push(pathname));
  const show = (id: FilterId) => visible[id] !== false;
  const collapsible = defaultCollapsed;
  const rangeLabel =
    sp.get("from") && sp.get("to")
      ? `${sp.get("from")} → ${sp.get("to")}`
      : null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={open}
          >
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[10px] text-[var(--muted)]"
              aria-hidden
            >
              {open ? "▾" : "▸"}
            </span>
            <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Filters
            </span>
            {!open && (
              <span className="truncate text-xs font-normal normal-case tracking-normal text-[var(--muted)]">
                {rangeLabel}
                {activeCount > 0
                  ? ` · ${activeCount} active`
                  : " · click to open"}
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Filters
            <InfoTip text="Filters apply to KPIs, tables, and CSV export. Dates use the timezone in the header (Dubai / IST / UTC). Use Filter fields to show/hide controls." />
          </div>
        )}
        {open && (
          <div className="flex items-center gap-2">
            {collapsible && (
              <InfoTip text="Filters apply to KPIs, tables, and CSV export. Dates use the timezone in the header (Dubai / IST / UTC). Use Filter fields to show/hide controls." />
            )}
            <ColumnPicker
              columns={FILTER_DEFS}
              visible={visible}
              defaults={defaults}
              onChange={persist}
              buttonLabel="Filter fields"
            />
          </div>
        )}
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border)] px-4 py-3">
          {show("dates") && (
            <>
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
            </>
          )}

          {show("responders") && (
            <SearchableMultiSelect
              label="Responders"
              endpoint="/api/directories/agents"
              paramKey="agent"
              selected={agents}
              onChange={(ids) => setMulti("agent", ids)}
              placeholder="Search agents…"
            />
          )}
          {show("customers") && (
            <SearchableMultiSelect
              label="Customers"
              endpoint="/api/directories/customers"
              paramKey="user"
              selected={users}
              onChange={(ids) => setMulti("user", ids)}
              placeholder="Search customers…"
            />
          )}
          {show("channel") && (
            <SearchableMultiSelect
              label="Channel"
              endpoint="/api/directories/channels"
              paramKey="channelId"
              selected={channels}
              onChange={(ids) => {
                push((next) => {
                  next.delete("channelId");
                  next.delete("channel");
                  for (const id of ids) next.append("channelId", id);
                });
              }}
              placeholder="Search channels…"
            />
          )}

          {show("subject") && (
            <Field label="Subject">
              <input
                ref={subjectRef}
                className="w-36 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                placeholder="label / unclassified"
                defaultValue={sp.get("subject") || ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySearch();
                  }
                }}
              />
            </Field>
          )}
          {show("group") && (
            <Field label="Group">
              <input
                ref={groupRef}
                className="w-32 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                placeholder="group"
                defaultValue={sp.get("group") || ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySearch();
                  }
                }}
              />
            </Field>
          )}
          {show("resolved") && (
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
          )}
          {show("reopened") && (
            <Field label="Reopened">
              <select
                className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                defaultValue={sp.get("reopened") || ""}
                onChange={(e) => update("reopened", e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Reopened</option>
                <option value="false">Not reopened</option>
              </select>
            </Field>
          )}
          {show("csat") && (
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
          )}
          {showSearch && show("search") && (
            <Field
              label="Search"
              tip={`Search will work for: ${SEARCH_COVERS}. Press Search (or Enter) to apply. Same query feeds KPIs, tables, and CSV export.`}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={qRef}
                  className="w-56 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                  placeholder={SEARCH_PLACEHOLDER}
                  defaultValue={sp.get("q") || ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySearch();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={applySearch}
                  disabled={pending}
                  className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
                >
                  Search
                </button>
              </div>
            </Field>
          )}
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--brand-soft)]"
          >
            Clear
          </button>
          {pending && (
            <span className="text-xs text-[var(--muted)]">Updating…</span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1 flex items-center text-xs font-medium text-[var(--muted)]">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      {children}
    </div>
  );
}
