"use client";

import { useEffect, useState } from "react";

type SyncPayload = {
  state?: string;
  lastCompletedAt?: string | null;
  campaign?: {
    id: string;
    status: string;
    pct: number;
    merged: number;
    total: number;
    pending: number;
    checkpoint?: {
      next_window_start?: string | null;
      pending_transcript_days?: number;
    } | null;
  } | null;
  quota?: { remaining: number; maxPerDay: number } | null;
};

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
        const data = json.data as SyncPayload | undefined;
        const state = data?.state;
        const at = data?.lastCompletedAt;
        const camp = data?.campaign;

        if (camp && camp.status !== "completed" && camp.total > 0) {
          const pendingDays = camp.checkpoint?.pending_transcript_days;
          const suffix =
            typeof pendingDays === "number"
              ? ` · ${pendingDays}d left`
              : "";
          if (camp.status === "paused_quota" || state === "paused_quota") {
            setLabel(`Backfill ${camp.pct}% (${camp.merged}/${camp.total})${suffix} — resume tomorrow`);
            setTone("text-amber-600");
            return;
          }
          if (state === "running") {
            setLabel(`Backfill ${camp.pct}% running…`);
            setTone("text-blue-600");
            return;
          }
          if (camp.status === "failed") {
            setLabel(`Backfill failed · ${camp.pct}%`);
            setTone("text-red-600");
            return;
          }
          setLabel(`Backfill ${camp.pct}% (${camp.merged}/${camp.total})${suffix}`);
          setTone("text-amber-600");
          return;
        }

        if (state === "never_run") {
          setLabel("Never synced");
          setTone("text-amber-600");
        } else if (state === "running") {
          setLabel("Sync running…");
          setTone("text-blue-600");
        } else if (state === "failed") {
          setLabel("Last sync failed");
          setTone("text-red-600");
        } else if (state === "partial" || state === "paused_quota") {
          setLabel(
            state === "paused_quota"
              ? "Quota pause — resume tomorrow"
              : "Last sync partial",
          );
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
