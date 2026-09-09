"use client";

import Link from "next/link";
import { ChannelBadge } from "@/components/ui/Identity";
import { RawJsonButton } from "@/components/ui/RawJson";
import {
  ColumnPicker,
  useColumnVisibility,
  type ColumnDef,
} from "@/components/ui/ColumnPicker";
import { formatInTimeZone } from "@/lib/timezone";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  referenceId?: string | null;
  enrichmentStatus?: string | null;
  conversationCount: number;
  messageCount: number;
  lastChannel: string | null;
  lastChannelKind: string;
  lastChannelIdentity: string | null;
  lastAgent: string | null;
  lastAgentId?: string | null;
  firstSeenAt?: string | Date | null;
  lastSeenAt: string | Date | null;
  raw?: unknown;
};

const STORAGE_KEY = "delicut.customers.columns.v1";

const ALL_COLUMNS = [
  { id: "name", label: "Customer Name", defaultOn: true },
  { id: "email", label: "Email", defaultOn: true },
  { id: "phone", label: "Phone", defaultOn: true },
  { id: "referenceId", label: "Reference ID", defaultOn: false },
  { id: "channel", label: "Channel", defaultOn: true },
  { id: "channelIdentity", label: "Number / handle", defaultOn: true },
  { id: "agent", label: "Responder", defaultOn: true },
  { id: "conversations", label: "Conversations", defaultOn: true },
  { id: "messages", label: "Messages", defaultOn: true },
  { id: "firstSeen", label: "First seen", defaultOn: false },
  { id: "lastSeen", label: "Last seen", defaultOn: true },
  { id: "enrichment", label: "Enrichment", defaultOn: false },
  { id: "id", label: "Customer ID", defaultOn: false },
  { id: "raw", label: "Raw", defaultOn: true },
] as const satisfies readonly ColumnDef<string>[];

type ColId = (typeof ALL_COLUMNS)[number]["id"];

function fmtWhen(
  value: string | Date | null | undefined,
  timeZone: string,
) {
  return formatInTimeZone(value ?? null, timeZone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function CustomersTable({
  items,
  timeZone,
  linkQuery,
  emptyHint,
}: {
  items: CustomerRow[];
  timeZone: string;
  linkQuery: string;
  emptyHint: string;
}) {
  const { visible, persist, cols, defaults } = useColumnVisibility<ColId>(
    STORAGE_KEY,
    ALL_COLUMNS,
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ColumnPicker
          columns={ALL_COLUMNS}
          visible={visible}
          defaults={defaults}
          onChange={persist}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
        <table className="dc-table min-w-[1100px]">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                {cols.map((c) => (
                  <td key={c.id}>{cell(c.id, u, timeZone, linkQuery)}</td>
                ))}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(cols.length, 1)}
                  className="py-12 text-center text-[var(--muted)]"
                >
                  {emptyHint}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cell(
  id: ColId,
  u: CustomerRow,
  timeZone: string,
  linkQuery: string,
) {
  switch (id) {
    case "name":
      return (
        <Link
          href={`/users/${u.id}?${linkQuery}`}
          className="font-medium text-[var(--brand-ink)] hover:text-[var(--brand)]"
        >
          {u.name}
        </Link>
      );
    case "email":
      return <span className="text-[var(--muted)]">{u.email || "—"}</span>;
    case "phone":
      return <span className="text-[var(--muted)]">{u.phone || "—"}</span>;
    case "referenceId":
      return (
        <span className="font-mono text-xs text-[var(--muted)]">
          {u.referenceId || "—"}
        </span>
      );
    case "channel":
      return <ChannelBadge channel={u.lastChannel} showIdentity={false} />;
    case "channelIdentity":
      return (
        <span className="font-mono text-xs text-[var(--muted)]">
          {u.lastChannelIdentity || "—"}
        </span>
      );
    case "agent":
      return u.lastAgentId ? (
        <Link
          href={`/responders/${u.lastAgentId}`}
          className="hover:text-[var(--brand)]"
        >
          {u.lastAgent || "—"}
        </Link>
      ) : (
        u.lastAgent || "—"
      );
    case "conversations":
      return (
        <span className="dc-pill">
          {u.conversationCount}{" "}
          {u.conversationCount === 1 ? "Chat" : "Chats"}
        </span>
      );
    case "messages":
      return u.messageCount;
    case "firstSeen":
      return (
        <span className="whitespace-nowrap text-[var(--muted)]">
          {fmtWhen(u.firstSeenAt, timeZone)}
        </span>
      );
    case "lastSeen":
      return (
        <span className="whitespace-nowrap text-[var(--muted)]">
          {fmtWhen(u.lastSeenAt, timeZone)}
        </span>
      );
    case "enrichment":
      return u.enrichmentStatus || "—";
    case "id":
      return (
        <span className="font-mono text-[10px] text-[var(--muted)]">
          {u.id.slice(0, 12)}…
        </span>
      );
    case "raw":
      return <RawJsonButton data={u.raw || u} />;
    default:
      return null;
  }
}
