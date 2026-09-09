"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TIMEZONE_OPTIONS,
  TZ_STORAGE_KEY,
  resolveTimeZone,
  type AppTimeZone,
} from "@/lib/timezone";

export function TimezoneSwitcher({
  defaultTimeZone,
}: {
  defaultTimeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [tz, setTz] = useState<AppTimeZone>(() =>
    resolveTimeZone(defaultTimeZone),
  );

  useEffect(() => {
    const fromUrl = sp.get("tz");
    const fromStore =
      typeof window !== "undefined"
        ? window.localStorage.getItem(TZ_STORAGE_KEY)
        : null;
    setTz(resolveTimeZone(fromUrl || fromStore || defaultTimeZone));
  }, [sp, defaultTimeZone]);

  const onChange = useCallback(
    (next: string) => {
      const resolved = resolveTimeZone(next, resolveTimeZone(defaultTimeZone));
      setTz(resolved);
      try {
        window.localStorage.setItem(TZ_STORAGE_KEY, resolved);
      } catch {
        /* ignore */
      }
      const params = new URLSearchParams(sp.toString());
      params.set("tz", resolved);
      router.push(`${pathname}?${params.toString()}`);
    },
    [defaultTimeZone, pathname, router, sp],
  );

  const meta = TIMEZONE_OPTIONS.find((o) => o.id === tz);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Timezone
        </div>
        <div className="text-xs font-medium text-[var(--brand-800)]">
          {meta?.label || tz}
        </div>
      </div>
      <label className="sr-only" htmlFor="tz-switch">
        Timezone
      </label>
      <select
        id="tz-switch"
        value={tz}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm"
        title="Dates & filters use this timezone"
      >
        {TIMEZONE_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
