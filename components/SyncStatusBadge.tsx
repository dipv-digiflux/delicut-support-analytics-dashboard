"use client";

import { useEffect, useState } from "react";

export function SyncStatusBadge() {
  const [label, setLabel] = useState("Checking sync…");
  const [tone, setTone] = useState("text-slate-500");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/sync-status");
        const json = await res.json();
        if (cancelled) return;
        const state = json.data?.state;
        const at = json.data?.lastCompletedAt;
        if (state === "never_run") {
          setLabel("Never synced");
          setTone("text-amber-600");
        } else if (state === "running") {
          setLabel("Sync running…");
          setTone("text-blue-600");
        } else if (state === "failed") {
          setLabel("Last sync failed");
          setTone("text-red-600");
        } else if (state === "partial") {
          setLabel("Last sync partial");
          setTone("text-amber-600");
        } else if (at) {
          const mins = Math.round(
            (Date.now() - new Date(at).getTime()) / 60000,
          );
          setLabel(
            mins < 1
              ? "Synced just now"
              : mins < 60
                ? `Synced ${mins}m ago`
                : `Synced ${Math.round(mins / 60)}h ago`,
          );
          setTone(mins > 24 * 60 ? "text-amber-600" : "text-slate-500");
        }
      } catch {
        if (!cancelled) {
          setLabel("Sync status unavailable");
          setTone("text-slate-400");
        }
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return <div className={`text-xs ${tone}`}>{label}</div>;
}
