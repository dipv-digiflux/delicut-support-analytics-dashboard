import { Suspense } from "react";
import { listCustomers } from "@/lib/customers";
import { getConfig } from "@/lib/config";
import { filtersFromSearchParams } from "@/lib/filter-defaults";
import { filtersToQuery, CUSTOMER_SORT_KEYS } from "@/lib/filters";
import { timezoneLabel } from "@/lib/timezone";
import { FilterBar } from "@/components/FilterBar";
import { ExportButton } from "@/components/ExportButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { InfoTip } from "@/components/ui/InfoTip";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);
  const q = typeof sp.q === "string" ? sp.q : filters.q || "";
  const cfg = getConfig();
  const sort = CUSTOMER_SORT_KEYS.has(filters.sort)
    ? filters.sort
    : "last_seen_at";
  const customerFilters = { ...filters, sort, q: q || undefined };

  let result: Awaited<ReturnType<typeof listCustomers>> | null = null;
  let error: string | null = null;
  try {
    result = await listCustomers(customerFilters);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const qs = filtersToQuery(customerFilters);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {result && (
            <span className="dc-count">
              {result.totalItems >= 1000
                ? `${(result.totalItems / 1000).toFixed(1)}k`
                : result.totalItems}
            </span>
          )}
          <div>
            <h1 className="flex items-center text-2xl font-bold text-[var(--brand-ink)]">
              Customers
              <InfoTip text="Customers who appear in conversations matching the filters. Open a row for chat history. Export CSV downloads every matching customer (exact, no row cap)." />
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {filters.from} → {filters.to} ({timezoneLabel(filters.timeZone)}) ·
              open a row for chat
            </p>
          </div>
        </div>
        <ExportButton
          endpoint="/api/customers/export"
          query={qs}
          label="Export CSV (exact)"
        />
      </div>

      <Suspense
        fallback={
          <div className="mb-6 h-20 animate-pulse rounded bg-slate-100" />
        }
      >
        <FilterBar showSearch />
      </Suspense>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Suspense
        fallback={<div className="h-40 animate-pulse rounded bg-slate-100" />}
      >
        <CustomersTable
          items={result?.items || []}
          timeZone={filters.timeZone}
          linkQuery={`from=${filters.from || ""}&to=${filters.to || ""}&tz=${filters.timeZone}`}
          emptyHint={
            cfg.hasFreshchatCredentials
              ? "No customers match these filters — try clearing filters or run sync"
              : "No customers found"
          }
          currentSort={sort}
          currentOrder={filters.order}
        />
      </Suspense>

      {result && (
        <Suspense fallback={null}>
          <PaginationBar
            page={result.page}
            totalPages={result.totalPages}
            totalItems={result.totalItems}
            limit={result.limit}
            limits={[10, 20, 25, 50, 100]}
          />
        </Suspense>
      )}
    </div>
  );
}
