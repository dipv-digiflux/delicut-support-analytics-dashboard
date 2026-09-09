"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble, type ChatMsg } from "@/components/chat/MessageBubble";
import { ChannelIcon } from "@/components/chat/ChannelIcon";
import { ChannelBadge, ProfileAvatar } from "@/components/ui/Identity";
import { RawJsonButton, RawJsonModal } from "@/components/ui/RawJson";
import { channelTheme, parseChannel } from "@/lib/display/channel";
import { shortId } from "@/lib/display/mask";
import { formatInTimeZone } from "@/lib/timezone";

type ConversationMeta = {
  id: string;
  channel: string | null;
  group: string | null;
  resolved: boolean;
  resolvedAt?: string | Date | null;
  createdAt?: string | Date | null;
  isStub?: boolean;
  conversationUrl?: string | null;
  messageCount?: number;
  csat?: { rating: number | null; feedback?: string | null } | null;
  metrics?: {
    first_response_time_seconds: number | null;
    resolution_time_seconds: number | null;
  };
  subject?: { label: string };
  labels?: { category: string | null; subcategory: string | null }[];
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    properties?: Record<string, unknown>;
  };
  agent: { id: string | null; name: string };
  raw?: unknown;
};

function fmtDur(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function ConversationChat({
  conversation,
  timeZone,
}: {
  conversation: ConversationMeta;
  timeZone: string;
}) {
  const [items, setItems] = useState<ChatMsg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [rawMsg, setRawMsg] = useState<unknown | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  const ch = parseChannel(conversation.channel);
  const theme = channelTheme(ch.kind);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages?limit=40`,
      );
      const json = await res.json();
      const batch = (json.data?.items || []) as ChatMsg[];
      setItems([...batch].reverse());
      setHasMore(Boolean(json.data?.hasMore));
      stickBottom.current = true;
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!stickBottom.current || !scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [items, loading]);

  const loadOlder = async () => {
    if (!items.length || loadingOlder || !hasMore) return;
    const oldest = items[0];
    setLoadingOlder(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight || 0;
    try {
      const before = new Date(oldest!.createdAt).toISOString();
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages?limit=40&before=${encodeURIComponent(before)}`,
      );
      const json = await res.json();
      const batch = (json.data?.items || []) as ChatMsg[];
      setHasMore(Boolean(json.data?.hasMore));
      setItems((prev) => [...[...batch].reverse(), ...prev]);
      stickBottom.current = false;
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollTop < 60) void loadOlder();
    stickBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const userName =
    conversation.user.name ||
    conversation.user.email ||
    conversation.user.phone ||
    "Customer";

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[480px] gap-3">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-white"
              style={{ background: theme.accent }}
            >
              <ChannelIcon kind={ch.kind} size="md" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <ChannelBadge channel={conversation.channel} />
                <span>
                  {conversation.resolved ? "Resolved" : "Open"} · scroll up for
                  older
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conversation.user.id && (
              <Link
                href={`/users/${conversation.user.id}`}
                className="text-xs text-[var(--brand)] hover:underline"
              >
                Customer chat
              </Link>
            )}
            <RawJsonButton data={conversation.raw || conversation} />
          </div>
        </div>

        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-3 py-3"
          style={{ background: theme.bg }}
        >
          {loading && (
            <div className="py-16 text-center text-[var(--muted)]">
              Loading messages…
            </div>
          )}
          {loadingOlder && (
            <div className="mb-2 text-center text-xs text-[var(--muted)]">
              Loading older…
            </div>
          )}
          {!loading && !hasMore && items.length > 0 && (
            <div className="mb-3 text-center text-xs text-[var(--muted)]">
              Beginning of conversation
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="py-16 text-center text-[var(--muted)]">
              No messages in synced transcript
            </div>
          )}
          {items.map((m) => (
            <MessageBubble
              key={m.messageId}
              message={m}
              channelKind={ch.kind}
              channelName={conversation.channel}
              timeZone={timeZone}
              customerFallbackName={userName}
              onRawClick={(msg) => setRawMsg(msg.raw || msg)}
            />
          ))}
        </div>
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white lg:flex">
        <div className="border-b border-[var(--border)] px-4 py-4 text-center">
          <ProfileAvatar
            name={userName}
            id={conversation.user.id}
            size={56}
          />
          <h2 className="mt-2 text-base font-bold">{userName}</h2>
          <p className="font-mono text-[10px] text-[var(--muted)]">
            {shortId(conversation.id, 12)}
          </p>
          <div className="mt-2 flex justify-center">
            <ChannelBadge channel={conversation.channel} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          <Section title="Customer">
            <Row label="Email" value={conversation.user.email || "—"} />
            <Row label="Phone" value={conversation.user.phone || "—"} />
            <Row label="User ID" value={conversation.user.id || "—"} mono />
            {Object.entries(conversation.user.properties || {}).map(
              ([k, v]) => (
                <Row key={k} label={k} value={String(v ?? "—")} />
              ),
            )}
          </Section>
          <Section title="Conversation">
            <Row
              label="Created"
              value={formatInTimeZone(
                conversation.createdAt ?? null,
                timeZone,
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                },
              )}
            />
            <Row
              label="Resolved"
              value={
                conversation.resolvedAt
                  ? formatInTimeZone(conversation.resolvedAt, timeZone, {
                      day: "2-digit",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : conversation.resolved
                    ? "Yes"
                    : "Open"
              }
            />
            <Row label="Responder" value={conversation.agent.name} />
            <Row label="Group" value={conversation.group || "—"} />
            <Row
              label="Label"
              value={
                conversation.labels?.[0]
                  ? [conversation.labels[0].category, conversation.labels[0].subcategory]
                      .filter(Boolean)
                      .join(" / ")
                  : conversation.subject?.label || "—"
              }
            />
            <Row
              label="CSAT"
              value={
                conversation.csat?.rating != null
                  ? String(conversation.csat.rating)
                  : "—"
              }
            />
            <Row
              label="First response"
              value={fmtDur(conversation.metrics?.first_response_time_seconds)}
            />
            <Row
              label="Resolution time"
              value={fmtDur(conversation.metrics?.resolution_time_seconds)}
            />
            <Row
              label="Messages"
              value={String(conversation.messageCount ?? items.length)}
            />
          </Section>
          {conversation.conversationUrl && (
            <a
              href={conversation.conversationUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-3 block text-center text-xs text-[var(--brand)] hover:underline"
            >
              Open in Freshchat
            </a>
          )}
        </div>
      </aside>

      {rawMsg != null && (
        <RawJsonModal
          data={rawMsg}
          title="Message raw"
          onClose={() => setRawMsg(null)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] py-1.5 text-xs">
      <span className="text-[var(--muted)]">{label}</span>
      <span
        className={`max-w-[60%] break-all text-right font-medium ${mono ? "font-mono text-[10px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
