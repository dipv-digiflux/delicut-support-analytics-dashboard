import Link from "next/link";
import { getSyncStatus } from "@/lib/aggregations";
import { getConfig } from "@/lib/config";
import {
  DATA_FLOW_PIPES,
  EXTRACT_EVENTS,
  NOT_GETTING,
  UI_SURFACES,
} from "@/lib/data-flow-content";
import { getDbCoverage } from "@/lib/sync/coverage";
import {
  formatDateOnlyInTimeZone,
  formatInTimeZone,
  timezoneLabel,
} from "@/lib/timezone";
import { InfoTip } from "@/components/ui/InfoTip";

export const dynamic = "force-dynamic";

export default async function DataFlowPage() {
  const cfg = getConfig();
  const enabled = new Set(cfg.syncEvents);
  const tz = cfg.REPORTING_TIMEZONE;
  const [coverage, sync] = await Promise.all([getDbCoverage(), getSyncStatus()]);
  const conv = coverage.collections.find((c) => c.name === "conversations");
  const customers =
    coverage.collections.find((c) => c.name === "users (customers)")?.count ?? 0;
  const coverageByEvent = new Map(
    coverage.mergedEvents.map((e) => [e.event, e]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="flex items-center text-2xl font-bold text-[var(--brand-ink)]">
          Data flow
          <InfoTip text="How Freshchat data reaches this dashboard, what we store, and what each screen reads. Source of truth is Extract CSV + Users API into Mongo — the UI never calls Freshchat for KPIs." />
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {cfg.APP_BRAND_NAME} Support Analytics · warehouse is local Mongo (
          {cfg.MONGODB_DB})
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-white p-4">
        <h2 className="mb-1 flex items-center text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Data available
          <InfoTip text="This is what is already in Mongo from Extract syncs — not a live Freshchat range. Dashboard filters outside this span will look empty." />
        </h2>
        <p className="text-lg font-semibold text-[var(--brand-ink)]">
          {dateSpan(conv?.from ?? null, conv?.to ?? null, tz)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Conversations by created time · {timezoneLabel(tz)}
          {conv?.count
            ? ` · ${conv.count.toLocaleString("en-GB")} chats`
            : " · no chats yet"}
          {customers
            ? ` · ${customers.toLocaleString("en-GB")} customers`
            : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Last sync{" "}
          {sync.lastCompletedAt
            ? formatInTimeZone(sync.lastCompletedAt, tz)
            : "never"}
          {sync.campaign
            ? ` · campaign ${sync.campaign.id}: ${dateSpan(sync.campaign.since, exclusiveEnd(sync.campaign.until), tz)} (${sync.campaign.status})`
            : ""}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="py-1.5 pr-3">Extract event</th>
                <th className="py-1.5 pr-3">Merged in Mongo</th>
                <th className="py-1.5">Windows</th>
              </tr>
            </thead>
            <tbody>
              {EXTRACT_EVENTS.filter((e) => enabled.has(e.event)).map((e) => {
                const row = coverageByEvent.get(e.event);
                return (
                  <tr key={e.event} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-xs">{e.event}</td>
                    <td className="py-1.5 pr-3 text-[var(--muted)]">
                      {row
                        ? dateSpan(row.from, exclusiveEnd(row.to), tz)
                        : "Not merged yet"}
                    </td>
                    <td className="py-1.5 text-[var(--muted)]">
                      {row ? row.windows.toLocaleString("en-GB") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="How data arrives" value="We pull (Extract)" />
        <Stat label="Webhooks" value="Not used" />
        <Stat label="Dashboard live?" value="No — last sync" />
        <Stat
          label="Events on by default"
          value={`${cfg.syncEvents.length} Extract types`}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          End-to-end
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white p-4">
          <pre className="text-[11px] leading-snug text-[var(--brand-ink)]">
{`Freshchat
   │
   ├── Extract API (CSV jobs)  ──WE USE──►  npm run sync*
   ├── Chat webhooks           ──unused─►  (no receiver)
   └── Users REST fetch        ──enrich─►  names / email / phone
                                              │
                                              ▼
                                           MongoDB
                                    conversations · users · sync_*
                                              │
                    ┌───────────────┬─────────┴─────────┬──────────────┐
                    ▼               ▼                   ▼              ▼
               /dashboard     /conversations         /users        CSV export
               KPIs/charts    table + chat           customers     convos + messages`}
          </pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Pipes from Freshchat
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {DATA_FLOW_PIPES.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold text-[var(--brand-ink)]">{p.name}</div>
                <span
                  className={`dc-pill ${
                    p.used
                      ? "!bg-[var(--brand-soft)] !text-[var(--brand)]"
                      : "!bg-slate-100"
                  }`}
                >
                  {p.usedLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {p.direction} · {p.when}
              </p>
              <p className="mt-2 text-sm">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          What we get (Extract events)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[#f8f8f9] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">This app</th>
                <th className="px-3 py-2">Gives us</th>
                <th className="px-3 py-2">Lands in</th>
                <th className="px-3 py-2">Used on</th>
              </tr>
            </thead>
            <tbody>
              {EXTRACT_EVENTS.map((e) => {
                    const on = enabled.has(e.event);
                return (
                  <tr key={e.event} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{e.event}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`dc-pill ${
                          on
                            ? "!bg-[var(--brand-soft)] !text-[var(--brand)]"
                            : ""
                        }`}
                      >
                        {on ? "Synced" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">{e.gives}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{e.landsIn}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{e.usedOn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Users: <span className="font-mono">POST /v2/users/fetch</span> →{" "}
          <span className="font-mono">users</span> collection (names, email, phone).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          How the UI uses it
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[#f8f8f9] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Screen</th>
                <th className="px-3 py-2">Reads</th>
              </tr>
            </thead>
            <tbody>
              {UI_SURFACES.map((s) => {
                const href = appHref(s.path);
                return (
                <tr key={s.path} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2">
                    {href ? (
                      <Link href={href} className="font-medium text-[var(--brand)] hover:underline">
                        {s.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--brand-ink)]">{s.name}</span>
                    )}
                    <div className="font-mono text-[10px] text-[var(--muted)]">{s.path}</div>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">{s.reads}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          What we will not get (current setup)
        </h2>
        <ul className="list-disc space-y-1 rounded-xl border border-[var(--border)] bg-white px-6 py-4 text-sm text-[var(--muted)]">
          {NOT_GETTING.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function exclusiveEnd(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - 1);
}

function dateSpan(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined,
  tz: string,
): string {
  if (!from && !to) return "None yet";
  return `${formatDateOnlyInTimeZone(from, tz)} → ${formatDateOnlyInTimeZone(to, tz)}`;
}

/** App Router <Link> cannot take template paths like /conversations/[id]. */
function appHref(path: string): string | null {
  if (path.startsWith("/api")) return "/conversations";
  if (!path.startsWith("/")) return null;
  const concrete = path.replace(/\/\[[^\]]+\]/g, "");
  return concrete || "/";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">{value}</div>
    </div>
  );
}
