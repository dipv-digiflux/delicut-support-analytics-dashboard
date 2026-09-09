import Link from "next/link";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Analytics
          </div>
          <div className="text-lg font-semibold text-slate-900">Freshchat</div>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/inbox"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Team Inbox
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Dashboard
          </Link>
          <Link
            href="/conversations"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            Raw data
          </Link>
        </nav>
        <div className="mt-auto px-2 pt-6 text-xs text-slate-400">
          Local Mongo · Extract sync
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <div className="text-sm font-medium text-slate-800">
            Freshchat Analytics Dashboard
          </div>
          <SyncStatusBadge />
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
