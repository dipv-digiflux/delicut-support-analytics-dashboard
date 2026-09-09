"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ListItem = {
  id: string;
  name: string;
  email: string | null;
  preview: string;
  createdAt: string | null;
  channel: string | null;
  subject: string;
  resolved: boolean;
  csat: number | null;
  agentName: string;
};

type Message = {
  id: string;
  actorType: string;
  actorName: string | null;
  body: string;
  createdAt: string | null;
  hasAttachment: boolean;
};

type Conversation = {
  id: string;
  createdAt: string | null;
  resolvedAt: string | null;
  resolved: boolean;
  reopened: boolean | null;
  status: string | null;
  channel: string | null;
  group: string | null;
  conversationUrl: string | null;
  subject: string;
  agent: { id: string | null; name: string };
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    properties: Record<string, string | number | boolean | null>;
  };
  csat: {
    rating: number | null;
    ratingRaw?: string | null;
    feedback: string | null;
    submittedAt: string | Date | null;
  } | null;
  labels: { category: string | null; subcategory: string | null }[];
  metrics: {
    first_response_time_seconds: number | null;
    resolution_time_seconds: number | null;
    response_time_seconds: number | null;
  };
  messages: Message[];
};

export function InboxShell({
  activeId,
  listQuery,
  totalItems,
  conversations,
  conversation,
}: {
  activeId: string;
  listQuery: string;
  totalItems: number;
  conversations: ListItem[];
  conversation: Conversation;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.email || "").toLowerCase().includes(needle) ||
        c.preview.toLowerCase().includes(needle) ||
        c.id.toLowerCase().includes(needle),
    );
  }, [conversations, q]);

  const userDisplay =
    conversation.user.name ||
    conversation.user.email ||
    conversation.user.phone ||
    "Visitor";

  const statusLabel = conversation.resolved ? "Resolved" : "Open";
  const topic =
    conversation.subject && conversation.subject !== "(no Freshchat label)"
      ? conversation.subject
      : "Conversation";

  return (
    <>
      {/* Conversation list */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">
          <div className="text-sm font-semibold text-slate-800">
            All conversations{" "}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {totalItems}
            </span>
          </div>
        </div>
        <div className="border-b border-slate-100 px-3 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter list…"
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#275ded]"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const active = c.id === activeId;
            const href = listQuery
              ? `/inbox/${c.id}?${listQuery}`
              : `/inbox/${c.id}`;
            return (
              <Link
                key={c.id}
                href={href}
                className={`block border-b border-slate-50 px-3 py-3 hover:bg-slate-50 ${
                  active ? "bg-[#e8eefc]" : "bg-white"
                }`}
              >
                <div className="flex gap-2.5">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.name}
                      </div>
                      <div className="shrink-0 text-[11px] text-slate-400">
                        {relTime(c.createdAt)}
                      </div>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {c.preview}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {c.channel && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {c.channel}
                        </span>
                      )}
                      {c.resolved ? (
                        <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                          Resolved
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          Open
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              No conversations in list
            </div>
          )}
        </div>
      </aside>

      {/* Chat thread */}
      <section className="flex min-w-0 flex-1 flex-col bg-[#f7f8fa]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {[conversation.channel, topic].filter(Boolean).join(" · ")}
            </div>
            <div className="text-xs text-slate-500">
              {[conversation.group, conversation.agent.name]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                conversation.resolved
                  ? "bg-green-50 text-green-700"
                  : "bg-[#275ded] text-white"
              }`}
            >
              {statusLabel}
            </span>
            {conversation.conversationUrl && (
              <a
                href={conversation.conversationUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Open in Freshchat
              </a>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {conversation.messages.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">
              No transcript messages synced yet
            </div>
          )}
          {conversation.messages.map((m) => {
            if (m.actorType === "system") {
              return (
                <div
                  key={m.id}
                  className="text-center text-[11px] text-slate-400"
                >
                  {m.body || "System"} · {fmtTime(m.createdAt)}
                </div>
              );
            }
            const isUser = m.actorType === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    isUser
                      ? "rounded-tl-md bg-[#dbe7ff] text-slate-900"
                      : m.actorType === "bot"
                        ? "rounded-tr-md bg-teal-600 text-white"
                        : "rounded-tr-md border border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div
                    className={`mb-1 text-[10px] font-medium ${
                      isUser || m.actorType === "agent"
                        ? "text-slate-500"
                        : "text-white/70"
                    }`}
                  >
                    {m.actorName || m.actorType} · {fmtTime(m.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.body || "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer — visual only (synced history is read-only) */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mb-2 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setComposerTab("reply")}
              className={`pb-1 ${
                composerTab === "reply"
                  ? "border-b-2 border-[#275ded] font-semibold text-[#275ded]"
                  : "text-slate-500"
              }`}
            >
              Reply
            </button>
            <button
              type="button"
              onClick={() => setComposerTab("note")}
              className={`pb-1 ${
                composerTab === "note"
                  ? "border-b-2 border-[#275ded] font-semibold text-[#275ded]"
                  : "text-slate-500"
              }`}
            >
              Private note
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
            Read-only analytics view — replies are sent in Freshchat. Start with
            &apos;/&apos; for canned responses there.
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled
              className="rounded-md bg-[#275ded]/60 px-4 py-1.5 text-sm font-medium text-white"
            >
              Send
            </button>
          </div>
        </div>
      </section>

      {/* Right properties */}
      <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-start gap-3">
            <Avatar name={userDisplay} large />
            <div>
              <div className="font-semibold text-slate-900">{userDisplay}</div>
              <div className="text-xs text-slate-500">
                {conversation.user.properties?.fc_user_timezone
                  ? String(conversation.user.properties.fc_user_timezone)
                  : "Contact"}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Prop label="Email" value={conversation.user.email || "—"} />
            <Prop label="Phone" value={conversation.user.phone || "—"} />
            <Prop label="User ID" value={conversation.user.id || "—"} mono />
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">
            Conversation properties
          </div>
          <div className="space-y-3 text-sm">
            <Field label="Group" value={conversation.group || "—"} />
            <Field label="Agent" value={conversation.agent.name} />
            <Field label="Status" value={statusLabel} />
            <Field
              label="Label"
              value={
                conversation.labels[0]
                  ? [conversation.labels[0].category, conversation.labels[0].subcategory]
                      .filter(Boolean)
                      .join(" / ")
                  : "—"
              }
            />
            <Field
              label="CSAT"
              value={
                conversation.csat?.rating != null
                  ? String(conversation.csat.rating)
                  : "Not rated"
              }
            />
            <Field
              label="First response"
              value={fmtDur(conversation.metrics.first_response_time_seconds)}
            />
            <Field
              label="Resolution time"
              value={fmtDur(conversation.metrics.resolution_time_seconds)}
            />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Properties are from Freshchat sync (view-only). Update them in
            Freshchat Admin / Inbox.
          </p>
        </div>

        <div className="px-4 py-4 text-xs text-slate-400">
          <button
            type="button"
            className="text-[#275ded] hover:underline"
            onClick={() => router.push(`/conversations/${conversation.id}`)}
          >
            Open raw detail page →
          </button>
        </div>
      </aside>
    </>
  );
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  const size = large ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#275ded] font-semibold text-white`}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function Prop({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-slate-500">{label}</div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800">
        {value}
      </div>
    </label>
  );
}

function relTime(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(0, mins)} mins ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} hrs ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

function fmtDur(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}
