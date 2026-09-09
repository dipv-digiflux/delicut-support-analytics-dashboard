"use client";

import { FormattedMessage } from "@/components/chat/FormattedMessage";
import { ChannelIcon } from "@/components/chat/ChannelIcon";
import { AttachmentBlock } from "@/components/chat/AttachmentBlock";
import { ProfileAvatar } from "@/components/ui/Identity";
import {
  channelTheme,
  parseChannel,
  type ChannelKind,
} from "@/lib/display/channel";
import { formatInTimeZone } from "@/lib/timezone";
import type { MediaItem } from "@/components/ui/MediaModal";

export type ChatMsg = {
  messageId: string;
  conversationId?: string;
  createdAt: string | Date;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail?: string | null;
  text: string;
  hasAttachment: boolean;
  attachments: MediaItem[];
  channelName?: string | null;
  raw?: unknown;
};

export function MessageBubble({
  message,
  channelKind,
  channelName,
  timeZone,
  customerFallbackName,
  onActorClick,
  onRawClick,
}: {
  message: ChatMsg;
  channelKind: ChannelKind;
  channelName?: string | null;
  timeZone: string;
  customerFallbackName?: string | null;
  onActorClick?: (m: ChatMsg) => void;
  onRawClick?: (m: ChatMsg) => void;
}) {
  const theme = channelTheme(channelKind);
  const fromCustomer = message.actorType === "user";
  const isSystem =
    message.actorType === "system" || message.actorType === "bot";
  const ch = parseChannel(channelName || message.channelName);
  const bubbleColor = isSystem
    ? "#f3f4f6"
    : fromCustomer
      ? theme.userBubble
      : theme.agentBubble;

  if (isSystem) {
    return (
      <div className="mb-2 flex justify-center">
        <div
          className="flex max-w-[90%] items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-center text-xs text-[var(--muted)] shadow-sm"
          style={{ backgroundColor: bubbleColor }}
        >
          <ChannelIcon kind={ch.kind} size="sm" className="mt-0.5 shrink-0 opacity-70" />
          <FormattedMessage text={message.text} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mb-2 flex items-end gap-2 ${
        fromCustomer ? "justify-start" : "justify-end"
      }`}
    >
      {fromCustomer && (
        <ProfileAvatar
          name={message.actorName || customerFallbackName}
          id={message.actorId}
          size={28}
          onClick={onActorClick ? () => onActorClick(message) : undefined}
        />
      )}
      <div
        className={`relative max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          fromCustomer ? "rounded-tl-sm" : "rounded-tr-sm"
        }`}
        style={{
          backgroundColor: bubbleColor,
          borderLeft: fromCustomer ? `3px solid ${theme.accent}` : undefined,
          borderRight: !fromCustomer ? `3px solid ${theme.accent}` : undefined,
        }}
      >
        <div
          className="absolute -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow"
          style={{
            color: theme.accent,
            [fromCustomer ? "left" : "right"]: -6,
          }}
          title={ch.label}
        >
          <ChannelIcon kind={ch.kind} size="sm" />
        </div>

        {!fromCustomer && (
          <button
            type="button"
            className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold"
            style={{ color: theme.accent }}
            onClick={onActorClick ? () => onActorClick(message) : undefined}
          >
            <ProfileAvatar
              name={message.actorName}
              id={message.actorId}
              size={16}
            />
            {message.actorName || "Responder"}
          </button>
        )}

        <FormattedMessage
          text={message.text || (message.hasAttachment ? "" : "—")}
        />
        <AttachmentBlock attachments={message.attachments || []} />

        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
          {onRawClick ? (
            <button
              type="button"
              className="hover:text-[var(--brand)]"
              onClick={() => onRawClick(message)}
            >
              raw
            </button>
          ) : (
            <span />
          )}
          <span>
            {ch.label}
            {" · "}
            {formatInTimeZone(message.createdAt, timeZone, {
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
          name={message.actorName}
          id={message.actorId}
          size={28}
          onClick={onActorClick ? () => onActorClick(message) : undefined}
        />
      )}
    </div>
  );
}
