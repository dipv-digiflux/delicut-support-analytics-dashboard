import Image from "next/image";
import { Suspense } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { TimezoneSwitcher } from "@/components/TimezoneSwitcher";
import { getConfig } from "@/lib/config";
import { resolveTimeZone } from "@/lib/timezone";

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = getConfig();
  const defaultTz = resolveTimeZone(cfg.REPORTING_TIMEZONE);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-4">
          <Image
            src="/logo.png"
            alt="Delicut"
            width={140}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        <SidebarNav />

        <div className="border-t border-[var(--border)] px-4 py-3 text-[10px] text-[var(--muted)]">
          © {year}. Delicut All rights reserved.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-white px-6 py-3">
          <div className="text-sm font-semibold text-[var(--brand-ink)]">
            {cfg.APP_BRAND_NAME}{" "}
            <span className="font-normal text-[var(--muted)]">
              {cfg.APP_PRODUCT_NAME}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Suspense fallback={null}>
              <TimezoneSwitcher defaultTimeZone={defaultTz} />
            </Suspense>
            <SyncStatusBadge />
          </div>
        </header>
        <main className="flex-1 px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
