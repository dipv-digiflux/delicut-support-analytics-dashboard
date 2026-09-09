import Link from "next/link";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f4f6]">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="text-base font-semibold text-slate-900">Team Inbox</div>
        <div className="flex flex-1 justify-center px-8">
          <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400">
            <SearchIcon />
            Search conversation, contacts, etc.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusBadge />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#275ded] text-xs font-semibold text-white">
            FC
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-2 bg-[#0b1f4d] py-3">
          <Link
            href="/inbox"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white"
            title="Inbox"
          >
            <InboxIcon />
          </Link>
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            title="Analytics"
          >
            <ChartIcon />
          </Link>
          <Link
            href="/conversations"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            title="Raw data"
          >
            <TableIcon />
          </Link>
          <div className="mt-auto mb-2">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 hover:text-white"
              title="Settings / docs"
            >
              <GearIcon />
            </Link>
          </div>
        </nav>

        {children}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v12H4z" />
      <path d="M4 12h4l2 3h4l2-3h4" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10M15 10v10" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
