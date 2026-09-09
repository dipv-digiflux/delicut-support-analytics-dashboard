"use client";

export function ExportButton({ query }: { query: string }) {
  const href = `/api/conversations/export?${query}`;
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      Export CSV (Excel)
    </a>
  );
}
