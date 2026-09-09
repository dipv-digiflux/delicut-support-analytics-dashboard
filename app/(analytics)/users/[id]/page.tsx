import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customers";
import { resolveTimeZone } from "@/lib/timezone";
import { getConfig } from "@/lib/config";
import { CustomerChatHistory } from "@/components/chat/CustomerChatHistory";
import { ExportButton } from "@/components/ExportButton";

export const dynamic = "force-dynamic";

export default async function UserChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const cfg = getConfig();
  const timeZone = resolveTimeZone(
    typeof sp.tz === "string" ? sp.tz : cfg.REPORTING_TIMEZONE,
  );
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;

  return (
    <div className="-mx-2 flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/users?tz=${timeZone}`}
            className="text-sm text-[var(--brand)] hover:underline"
          >
            ← Customers
          </Link>
          <h1 className="text-lg font-bold text-[var(--brand-ink)]">
            {customer.name}
          </h1>
          <span className="text-xs text-[var(--muted)]">
            {customer.email || customer.phone || customer.id}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ExportButton
            endpoint={`/api/customers/${id}/export`}
            query={[
              from ? `from=${from}` : "",
              to ? `to=${to}` : "",
            ]
              .filter(Boolean)
              .join("&")}
            label="Export chat CSV"
          />
          <form className="flex items-end gap-2 text-sm">
            <input type="hidden" name="tz" value={timeZone} />
            <label className="block">
              <span className="text-xs text-[var(--muted)]">From</span>
              <input
                type="date"
                name="from"
                defaultValue={from || ""}
                className="ml-1 rounded border border-[var(--border)] px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">To</span>
              <input
                type="date"
                name="to"
                defaultValue={to || ""}
                className="ml-1 rounded border border-[var(--border)] px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-[var(--brand)] px-3 py-1.5 text-white"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-[70vh] items-center justify-center text-[var(--muted)]">
            Loading…
          </div>
        }
      >
        <CustomerChatHistory
          userId={id}
          from={from}
          to={to}
          timeZone={timeZone}
        />
      </Suspense>
    </div>
  );
}
