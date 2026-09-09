"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "▣" },
  { href: "/conversations", label: "Conversations", icon: "☰" },
  { href: "/users", label: "Customers", icon: "☺" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Support
      </div>
      <div className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 ${
                active
                  ? "bg-[#f0f1f3] font-medium text-[var(--brand-ink)]"
                  : "text-[var(--foreground)] hover:bg-white"
              }`}
            >
              <span
                className={`w-4 text-center ${
                  active ? "text-[var(--brand)]" : "text-[var(--muted)]"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
