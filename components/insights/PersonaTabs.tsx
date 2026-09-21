"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/insights/cx", label: "Experience" },
  { href: "/insights/marketing", label: "Demand" },
] as const;

export function PersonaTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <div className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-white p-0.5 text-sm">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${suffix}`}
            className={`rounded-md px-3 py-1.5 ${
              active
                ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]"
                : "text-[var(--muted)] hover:text-[var(--brand-ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
