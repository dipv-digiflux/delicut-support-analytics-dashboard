"use client";

import { useState } from "react";

export function ExportButton({
  query,
  endpoint = "/api/conversations/export",
  label = "Export CSV",
}: {
  query: string;
  endpoint?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setNote(null);
    try {
      const sep = query ? (endpoint.includes("?") ? "&" : "?") : "";
      const res = await fetch(`${endpoint}${sep}${query}`);
      if (!res.ok) {
        setNote("Export failed");
        return;
      }
      const truncated = res.headers.get("X-Export-Truncated") === "true";
      const exported = res.headers.get("X-Export-Rows");
      const total = res.headers.get("X-Export-Total-Matched");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] || "export.csv";
      a.click();
      URL.revokeObjectURL(url);
      if (truncated) {
        setNote(
          `Exported ${exported} of ${total} matching rows (cap reached). Narrow filters for a full export.`,
        );
      } else {
        setNote(`Exported ${exported} rows (exact)`);
      }
    } catch {
      setNote("Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
      >
        {busy ? "Exporting…" : label}
      </button>
      {note && (
        <div className="max-w-xs text-right text-xs text-slate-500">{note}</div>
      )}
    </div>
  );
}
