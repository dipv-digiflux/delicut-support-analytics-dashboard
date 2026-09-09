"use client";

import { avatarColor, initials } from "@/lib/display/mask";
import { parseChannel } from "@/lib/display/channel";

export function ChannelBadge({
  channel,
  showIdentity = true,
}: {
  channel: string | null;
  showIdentity?: boolean;
}) {
  const p = parseChannel(channel);
  const theme =
    p.kind === "whatsapp"
      ? "bg-[#dcf8c6] text-[#075e54]"
      : p.kind === "instagram"
        ? "bg-fuchsia-100 text-fuchsia-800"
        : p.kind === "phone"
          ? "bg-blue-100 text-blue-800"
          : "bg-slate-100 text-slate-700";
  return (
    <span className={`dc-pill !rounded-md ${theme}`} title={p.raw || undefined}>
      {p.label}
      {showIdentity && p.identity ? ` · ${p.identity}` : ""}
    </span>
  );
}

export function ProfileAvatar({
  name,
  id,
  size = 32,
  onClick,
  title,
}: {
  name: string | null | undefined;
  id?: string | null;
  size?: number;
  onClick?: () => void;
  title?: string;
}) {
  const seed = id || name || "?";
  const bg = avatarColor(seed);
  const label = initials(name, "?");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title || name || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        onClick ? "cursor-pointer ring-offset-1 hover:ring-2 hover:ring-[var(--brand)]" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.35),
        background: bg,
      }}
    >
      {label}
    </Tag>
  );
}
