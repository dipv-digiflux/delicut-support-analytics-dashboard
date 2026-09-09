import Link from "next/link";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { getConfig } from "@/lib/config";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conversations", label: "Conversations" },
  { href: "/users", label: "Users" },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = getConfig();
  const brand = cfg.APP_BRAND_NAME;
  const product = cfg.APP_PRODUCT_NAME;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] px-4 py-6">
        <div className="mb-8 px-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {product}
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-[var(--brand-800)]">
            {brand}
          </div>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[var(--foreground)] transition hover:bg-[var(--brand-50)] hover:text-[var(--brand-800)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-6 text-xs text-[var(--muted)]">
          Freshchat extract · Local Mongo
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/90 px-6 py-3 backdrop-blur">
          <div className="text-sm font-medium text-[var(--foreground)]">
            {brand} {product}
          </div>
          <SyncStatusBadge />
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
