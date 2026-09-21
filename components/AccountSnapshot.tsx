import type { PlatformSnapshot } from "@/lib/platform/lookup";

function money(n: number | null) {
  if (n == null) return "—";
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function AccountSnapshot({
  snapshot,
}: {
  snapshot: PlatformSnapshot | null | undefined;
}) {
  const s = snapshot || {
    status: "unconfigured" as const,
    customerId: null,
    phone: null,
    email: null,
    totalOrders: null,
    totalSpent: null,
    aov: null,
    subscriptionOrders: null,
    note: "Set PLATFORM_MONGODB_URI to join chats to orders.",
  };

  const statusLabel =
    s.status === "matched"
      ? "Matched"
      : s.status === "ambiguous"
        ? "Ambiguous"
        : s.status === "unmatched"
          ? "Unmatched"
          : "Not configured";

  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Account / orders
      </div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">Join</span>
        <span
          className={
            s.status === "matched"
              ? "font-medium text-emerald-700"
              : s.status === "ambiguous"
                ? "font-medium text-amber-700"
                : "text-[var(--muted)]"
          }
        >
          {statusLabel}
        </span>
      </div>
      <Row label="Customer id" value={s.customerId || "—"} mono />
      <Row label="Orders" value={s.totalOrders != null ? String(s.totalOrders) : "—"} />
      <Row label="Spent" value={money(s.totalSpent)} />
      <Row label="AOV" value={money(s.aov)} />
      <Row
        label="Subscriptions"
        value={
          s.subscriptionOrders != null ? String(s.subscriptionOrders) : "—"
        }
      />
      {s.note ? (
        <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
          {s.note}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mb-1 flex items-start justify-between gap-2 text-xs">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span
        className={`min-w-0 text-right ${mono ? "font-mono text-[10px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
