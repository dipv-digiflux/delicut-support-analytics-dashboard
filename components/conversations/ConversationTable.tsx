"use client";

import Link from "next/link";
import { ChannelBadge } from "@/components/ui/Identity";
import { RawJsonButton } from "@/components/ui/RawJson";
import {
  ColumnPicker,
  useColumnVisibility,
  type ColumnDef,
} from "@/components/ui/ColumnPicker";
import { parseChannel } from "@/lib/display/channel";
import { formatInTimeZone } from "@/lib/timezone";

export type ConversationRow = {
  id: string;
  createdAt: string | Date | null;
  updatedAt?: string | Date | null;
  lastMessageAt?: string | Date | null;
  resolvedAt?: string | Date | null;
  channel: string | null;
  group: string | null;
  status?: string | null;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  subject: { label: string; slug: string };
  resolutionSubLabel?: string | null;
  agent: { id: string | null; name: string };
  resolved: boolean;
  reopened: boolean | null;
  csat: number | null;
  csatComment?: string | null;
  messageCount: number;
  attachmentCount?: number;
  firstResponseSeconds: number | null;
  resolutionSeconds?: number | null;
  preview: string;
  conversationUrl: string | null;
  isStub?: boolean;
};

const STORAGE_KEY = "delicut.conversations.columns.v2";

const ALL_COLUMNS = [
  { id: "createdAt", label: "Date / Time", defaultOn: true },
  { id: "lastMessageAt", label: "Last message", defaultOn: false },
  { id: "resolvedAt", label: "Resolved at", defaultOn: false },
  { id: "user", label: "Customer", defaultOn: true },
  { id: "email", label: "Email", defaultOn: false },
  { id: "phone", label: "Phone", defaultOn: true },
  { id: "channel", label: "Channel", defaultOn: true },
  { id: "channelIdentity", label: "Number / handle", defaultOn: true },
  { id: "group", label: "Group", defaultOn: false },
  { id: "label", label: "Label", defaultOn: true },
  { id: "subLabel", label: "Sub-label", defaultOn: false },
  { id: "agent", label: "Responder", defaultOn: true },
  { id: "status", label: "Status", defaultOn: false },
  { id: "resolved", label: "Resolved", defaultOn: true },
  { id: "reopened", label: "Reopened", defaultOn: false },
  { id: "csat", label: "CSAT", defaultOn: true },
  { id: "csatComment", label: "CSAT comment", defaultOn: false },
  { id: "messages", label: "Msgs", defaultOn: true },
  { id: "attachments", label: "Files", defaultOn: true },
  { id: "frt", label: "FRT", defaultOn: true },
  { id: "resolutionTime", label: "Resolution time", defaultOn: false },
  { id: "preview", label: "Preview", defaultOn: false },
  { id: "freshchatUrl", label: "Freshchat URL", defaultOn: false },
  { id: "stub", label: "Stub", defaultOn: false },
  { id: "id", label: "Conversation ID", defaultOn: false },
  { id: "raw", label: "Raw", defaultOn: true },
] as const satisfies readonly ColumnDef<string>[];

type ColId = (typeof ALL_COLUMNS)[number]["id"];

function fmtDur(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

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

export function ConversationTable({
  items,
  timeZone,
}: {
  items: ConversationRow[];
  timeZone: string;
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
            {items.map((row) => (
              <tr key={row.id}>
                {cols.map((c) => (
                  <td key={c.id}>{cell(c.id, row, timeZone)}</td>
                ))}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(cols.length, 1)}
                  className="px-4 py-12 text-center text-[var(--muted)]"
                >
                  No conversations match these filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cell(id: ColId, row: ConversationRow, timeZone: string) {
  const ch = parseChannel(row.channel);
  switch (id) {
    case "createdAt":
      return (
        <span className="whitespace-nowrap text-[var(--muted)]">
          {fmtWhen(row.createdAt, timeZone)}
        </span>
      );
    case "lastMessageAt":
      return (
        <span className="whitespace-nowrap text-[var(--muted)]">
          {fmtWhen(row.lastMessageAt, timeZone)}
        </span>
      );
    case "resolvedAt":
      return (
        <span className="whitespace-nowrap text-[var(--muted)]">
          {fmtWhen(row.resolvedAt, timeZone)}
        </span>
      );
    case "user":
      return (
        <Link
          href={row.user.id ? `/users/${row.user.id}` : `#`}
          className="font-medium text-[var(--brand-ink)] hover:text-[var(--brand)]"
        >
          {row.user.name || "Unknown"}
        </Link>
      );
    case "email":
      return (
        <span className="text-xs text-[var(--muted)]">
          {row.user.email || "—"}
        </span>
      );
    case "phone":
      return (
        <span className="text-xs text-[var(--muted)]">
          {row.user.phone || "—"}
        </span>
      );
    case "channel":
      return <ChannelBadge channel={row.channel} showIdentity={false} />;
    case "channelIdentity":
      return (
        <span className="font-mono text-xs text-[var(--muted)]">
          {ch.identity || "—"}
        </span>
      );
    case "group":
      return row.group || "—";
    case "label":
      return (
        <Link
          href={`/conversations/${row.id}`}
          className={`dc-pill ${
            row.subject.slug === "unlabeled"
              ? ""
              : "!bg-[var(--brand-soft)] !text-[var(--brand)]"
          }`}
          title={row.subject.label}
        >
          {row.subject.label}
        </Link>
      );
    case "subLabel":
      return row.resolutionSubLabel || "—";
    case "agent":
      return row.agent.id ? (
        <Link
          href={`/responders/${row.agent.id}`}
          className="hover:text-[var(--brand)]"
        >
          {row.agent.name}
        </Link>
      ) : (
        row.agent.name
      );
    case "status":
      return row.status || "—";
    case "resolved":
      return row.resolved ? (
        <span className="text-[var(--success)]">Yes</span>
      ) : (
        <span className="text-[var(--muted)]">No</span>
      );
    case "reopened":
      return row.reopened == null ? "—" : row.reopened ? "Yes" : "No";
    case "csat":
      return row.csat == null ? (
        <span className="text-[var(--muted)]">—</span>
      ) : (
        <span className="font-semibold">{row.csat}</span>
      );
    case "csatComment":
      return (
        <span className="line-clamp-2 max-w-[200px] text-xs text-[var(--muted)]">
          {row.csatComment || "—"}
        </span>
      );
    case "messages":
      return <span className="dc-pill">{row.messageCount}</span>;
    case "attachments":
      return row.attachmentCount ? (
        <span className="dc-pill">{row.attachmentCount}</span>
      ) : (
        "—"
      );
    case "frt":
      return fmtDur(row.firstResponseSeconds);
    case "resolutionTime":
      return fmtDur(row.resolutionSeconds);
    case "preview":
      return (
        <span className="line-clamp-1 max-w-[220px] text-[var(--muted)]">
          {row.preview || "—"}
        </span>
      );
    case "freshchatUrl":
      return row.conversationUrl ? (
        <a
          href={row.conversationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--brand)] hover:underline"
        >
          Open
        </a>
      ) : (
        "—"
      );
    case "stub":
      return row.isStub ? "Yes" : "No";
    case "id":
      return (
        <Link
          href={`/conversations/${row.id}`}
          className="font-mono text-[10px] text-[var(--brand)] hover:underline"
        >
          {row.id.slice(0, 12)}…
        </Link>
      );
    case "raw":
      return <RawJsonButton data={row} />;
    default:
      return null;
  }
}
