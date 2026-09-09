"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage } from "@/components/chat/FormattedMessage";
import { ChannelBadge, ProfileAvatar } from "@/components/ui/Identity";
import { MediaModal, type MediaItem } from "@/components/ui/MediaModal";
import { RawJsonButton, RawJsonModal } from "@/components/ui/RawJson";
import { channelTheme, parseChannel } from "@/lib/display/channel";
import { shortId } from "@/lib/display/mask";
import { formatInTimeZone } from "@/lib/timezone";

type Msg = {
  messageId: string;
  conversationId: string;
  createdAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  text: string;
  hasAttachment: boolean;
  attachments: {
    kind: string;
    url: string | null;
    file_name: string | null;
    mime_type?: string | null;
    thumbnail_url?: string | null;
  }[];
  channelName: string | null;
  channelId: string | null;
  messageSource: string | null;
  raw: Record<string, string> | null;
};

type CustomerProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  referenceId?: string | null;
  role: string;
  properties: Record<string, unknown>;
  enrichment?: unknown;
  stats?: {
    first_seen_at?: string | Date | null;
    last_seen_at?: string | Date | null;
    conversation_count?: number;
  };
  conversations?: {
    id: string;
    channel: string | null;
    createdAt: string | Date | null;
    resolved: boolean;
    agentName: string | null;
    messageCount: number;
    csat: number | null;
    label: string | null;
  }[];
  raw?: unknown;
};

type ActorInfo = {
  id: string | null;
  name: string | null;
  email: string | null;
  type: string;
  href?: string | null;
};

export function CustomerChatHistory({
  userId,
  from,
  to,
  timeZone,
  initialCustomer,
}: {
  userId: string;
  from?: string;
  to?: string;
  timeZone: string;
  initialCustomer?: CustomerProfile | null;
}) {
  const [items, setItems] = useState<Msg[]>([]);
  const [customer, setCustomer] = useState<CustomerProfile | null>(
    initialCustomer || null,
  );
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [actorInfo, setActorInfo] = useState<ActorInfo | null>(null);
  const [rawMsg, setRawMsg] = useState<unknown | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("limit", "50");
    return p.toString();
  }, [from, to]);

  const dominantChannel = useMemo(() => {
    const last = items[items.length - 1]?.channelName || customer?.conversations?.[0]?.channel;
    return parseChannel(last || null);
  }, [items, customer]);

  const theme = channelTheme(dominantChannel.kind);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${userId}?${qs}`);
      const json = await res.json();
      if (json.data?.customer) setCustomer(json.data.customer);
      const batch = (json.data?.messages?.items || []) as Msg[];
      setItems([...batch].reverse());
      setHasMore(Boolean(json.data?.messages?.hasMore));
      stickBottom.current = true;
    } finally {
      setLoading(false);
    }
  }, [userId, qs]);

  useEffect(() => {
    loadInitial();
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
      const p = new URLSearchParams(qs);
      p.set("before", new Date(oldest!.createdAt).toISOString());
      const res = await fetch(`/api/customers/${userId}?${p.toString()}`);
      const json = await res.json();
      const batch = (json.data?.messages?.items || []) as Msg[];
      setHasMore(Boolean(json.data?.messages?.hasMore));
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

  const exportProfile = () => {
    const blob = new Blob(
      [JSON.stringify({ customer, messages: items }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-${userId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading && !items.length) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-[var(--muted)]">
        Loading chat…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[480px] gap-3">
      {/* Center: chat */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ProfileAvatar name={customer?.name} id={userId} size={28} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {customer?.name || "Customer"}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <ChannelBadge channel={dominantChannel.raw} />
                <span>scroll up for older</span>
              </div>
            </div>
          </div>
          <RawJsonButton data={{ customer, sampleMessages: items.slice(-5) }} />
        </div>

        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-3 py-3"
          style={{ background: theme.bg }}
        >
          {loadingOlder && (
            <div className="mb-2 text-center text-xs text-[var(--muted)]">
              Loading older…
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <div className="mb-3 text-center text-xs text-[var(--muted)]">
              Beginning of history
            </div>
          )}
          {items.length === 0 && (
            <div className="m-auto py-20 text-center text-[var(--muted)]">
              No messages in range
            </div>
          )}

          {items.map((m, idx) => {
            const prev = items[idx - 1];
            const showDivider =
              !prev || prev.conversationId !== m.conversationId;
            const fromCustomer = m.actorType === "user";
            const isSystem = m.actorType === "system" || m.actorType === "bot";
            const ch = parseChannel(m.channelName);
            const bubbleColor = isSystem
              ? "#f3f4f6"
              : fromCustomer
                ? theme.userBubble
                : theme.agentBubble;

            return (
              <div key={`${m.conversationId}-${m.messageId}-${idx}`}>
                {showDivider && (
                  <div className="my-3 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <ChannelBadge channel={m.channelName} />
                    <span>#{shortId(m.conversationId, 8)}</span>
                    <Link
                      href={`/conversations/${m.conversationId}`}
                      className="text-[var(--brand)] normal-case hover:underline"
                    >
                      open
                    </Link>
                  </div>
                )}

                {isSystem ? (
                  <div className="mb-2 flex justify-center">
                    <div
                      className="max-w-[85%] rounded-lg border border-[var(--border)] px-3 py-1.5 text-center text-xs text-[var(--muted)] shadow-sm"
                      style={{ backgroundColor: bubbleColor }}
                    >
                      <FormattedMessage text={m.text} />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mb-2 flex items-end gap-2 ${
                      fromCustomer ? "justify-start" : "justify-end"
                    }`}
                  >
                    {fromCustomer && (
                      <ProfileAvatar
                        name={m.actorName || customer?.name}
                        id={m.actorId || userId}
                        size={28}
                        onClick={() =>
                          setActorInfo({
                            id: m.actorId || userId,
                            name: m.actorName || customer?.name || null,
                            email: m.actorEmail || customer?.email || null,
                            type: "customer",
                            href: `/users/${m.actorId || userId}`,
                          })
                        }
                      />
                    )}
                    <div
                      className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        fromCustomer ? "rounded-tl-sm" : "rounded-tr-sm"
                      }`}
                      style={{
                        backgroundColor: bubbleColor,
                        borderLeft: fromCustomer
                          ? `3px solid ${theme.accent}`
                          : undefined,
                        borderRight: !fromCustomer
                          ? `3px solid ${theme.accent}`
                          : undefined,
                      }}
                    >
                      {!fromCustomer && (
                        <button
                          type="button"
                          className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold"
                          style={{ color: theme.accent }}
                          onClick={() =>
                            setActorInfo({
                              id: m.actorId,
                              name: m.actorName,
                              email: m.actorEmail,
                              type: m.actorType,
                              href: m.actorId
                                ? `/responders/${m.actorId}`
                                : null,
                            })
                          }
                        >
                          <ProfileAvatar
                            name={m.actorName}
                            id={m.actorId}
                            size={16}
                          />
                          {m.actorName || "Responder"}
                        </button>
                      )}
                      <FormattedMessage
                        text={
                          m.text || (m.hasAttachment ? "" : "—")
                        }
                      />
                      {(m.attachments || []).map((a, i) => (
                        <button
                          key={i}
                          type="button"
                          className="mt-1 block w-full text-left"
                          onClick={() => setMedia(a)}
                        >
                          {a.url &&
                          (a.kind === "image" ||
                            a.mime_type?.startsWith("image/")) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.url}
                              alt={a.file_name || "image"}
                              className="max-h-40 rounded-lg hover:opacity-90"
                            />
                          ) : (
                            <div className="rounded bg-black/5 px-2 py-1 text-xs hover:bg-black/10">
                              📎 {a.kind}
                              {a.file_name ? `: ${a.file_name}` : ""}
                              {!a.url && " (no URL)"}
                            </div>
                          )}
                        </button>
                      ))}
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                        <button
                          type="button"
                          className="hover:text-[var(--brand)]"
                          onClick={() => setRawMsg(m.raw || m)}
                        >
                          raw
                        </button>
                        <span>
                          {ch.label}
                          {" · "}
                          {formatInTimeZone(m.createdAt, timeZone, {
                            day: "2-digit",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                    {!fromCustomer && (
                      <ProfileAvatar
                        name={m.actorName}
                        id={m.actorId}
                        size={28}
                        onClick={() =>
                          setActorInfo({
                            id: m.actorId,
                            name: m.actorName,
                            email: m.actorEmail,
                            type: m.actorType,
                            href: m.actorId
                              ? `/responders/${m.actorId}`
                              : null,
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: profile */}
      <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white lg:flex">
        <div className="border-b border-[var(--border)] px-4 py-4 text-center">
          <ProfileAvatar name={customer?.name} id={userId} size={64} />
          <h2 className="mt-2 text-base font-bold text-[var(--brand-ink)]">
            {customer?.name}
          </h2>
          <p className="font-mono text-[10px] text-[var(--muted)]">
            {shortId(userId, 12)}
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={exportProfile}
              className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase"
            >
              Export
            </button>
            <RawJsonButton data={customer?.raw || customer} label="JSON" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          <Section title="Contact">
            <Row label="Email" value={customer?.email || "—"} />
            <Row label="Phone" value={customer?.phone || "—"} />
            <Row
              label="Reference"
              value={customer?.referenceId || "—"}
            />
          </Section>

          <Section title="Channel">
            <div className="mb-2">
              <ChannelBadge channel={dominantChannel.raw} />
            </div>
            <Row label="Kind" value={dominantChannel.label} />
            <Row
              label="Line / handle"
              value={dominantChannel.identity || "—"}
            />
          </Section>

          <Section title="Activity">
            <Row
              label="Conversations"
              value={String(
                customer?.conversations?.length ??
                  customer?.stats?.conversation_count ??
                  0,
              )}
            />
            <Row
              label="First seen"
              value={formatInTimeZone(
                customer?.stats?.first_seen_at ?? null,
                timeZone,
                { day: "2-digit", month: "short", year: "numeric" },
              )}
            />
            <Row
              label="Last seen"
              value={formatInTimeZone(
                customer?.stats?.last_seen_at ?? null,
                timeZone,
                { day: "2-digit", month: "short", year: "numeric" },
              )}
            />
          </Section>

          {Object.keys(customer?.properties || {}).length > 0 && (
            <Section title="Properties">
              {Object.entries(customer!.properties).map(([k, v]) => (
                <Row key={k} label={k} value={String(v ?? "—")} />
              ))}
            </Section>
          )}

          <Section title="Conversation history">
            <div className="overflow-hidden rounded border border-[var(--border)]">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[#f3f4f6] text-left">
                    <th className="px-2 py-1">When</th>
                    <th className="px-2 py-1">Ch</th>
                    <th className="px-2 py-1">Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {(customer?.conversations || []).slice(0, 40).map((c) => {
                    const ch = parseChannel(c.channel);
                    return (
                      <tr
                        key={c.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-2 py-1 whitespace-nowrap">
                          <Link
                            href={`/conversations/${c.id}`}
                            className="text-[var(--brand)] hover:underline"
                          >
                            {formatInTimeZone(c.createdAt, timeZone, {
                              day: "2-digit",
                              month: "short",
                            })}
                          </Link>
                        </td>
                        <td className="px-2 py-1" title={c.channel || ""}>
                          {ch.label}
                        </td>
                        <td
                          className="max-w-[90px] truncate px-2 py-1"
                          title={c.agentName || ""}
                        >
                          {c.agentName || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!customer?.conversations?.length && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2 py-3 text-center text-[var(--muted)]"
                      >
                        No history
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </aside>

      {media && <MediaModal item={media} onClose={() => setMedia(null)} />}
      {rawMsg != null && (
        <RawJsonModal
          data={rawMsg}
          title="Message raw"
          onClose={() => setRawMsg(null)}
        />
      )}
      {actorInfo && (
        <ActorInfoModal
          info={actorInfo}
          onClose={() => setActorInfo(null)}
        />
      )}
    </div>
  );
}

function ActorInfoModal({
  info,
  onClose,
}: {
  info: ActorInfo;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center gap-3">
          <ProfileAvatar name={info.name} id={info.id} size={48} />
          <div>
            <div className="font-semibold">{info.name || "Unknown"}</div>
            <div className="text-xs uppercase text-[var(--muted)]">
              {info.type}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="ID" value={info.id || "—"} />
          <Row label="Email" value={info.email || "—"} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {info.href && (
            <Link
              href={info.href}
              className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm text-white"
            >
              Open profile
            </Link>
          )}
          <button
            type="button"
            className="rounded border border-[var(--border)] px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
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
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] py-1.5 text-xs">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="max-w-[60%] text-right font-medium" title={hint}>
        {value}
      </span>
    </div>
  );
}
