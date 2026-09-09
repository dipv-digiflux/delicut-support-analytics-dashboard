"use client";

import type { ChannelKind } from "@/lib/display/channel";

const sizeMap = { sm: 14, md: 18, lg: 22 } as const;

/** Small channel glyph for message chrome / headers. */
export function ChannelIcon({
  kind,
  size = "md",
  className = "",
}: {
  kind: ChannelKind;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const px = sizeMap[size];
  const common = {
    width: px,
    height: px,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className,
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.1-.3.2-.6.1-1.6-.6-2.9-1.5-3.9-2.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.7 2.3.7 3.1.6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z" />
          <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.2-1.3C8.7 21.5 10.3 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-1.5 0-3-.4-4.3-1.1l-.3-.2-3.1.8.8-3-.2-.3C4.4 15 4 13.5 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm10 1.5a1 1 0 110 2 1 1 0 010-2zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z" />
        </svg>
      );
    case "web":
      return (
        <svg {...common}>
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm7.9 9h-3.2a15 15 0 00-1.3-5 8 8 0 014.5 5zM12 4c.9 1.3 1.7 3.1 2.1 5H9.9C10.3 7.1 11.1 5.3 12 4zM4.1 11a8 8 0 014.5-5 15 15 0 00-1.3 5H4.1zm0 2h3.2a15 15 0 001.3 5 8 8 0 01-4.5-5zm7.9 7c-.9-1.3-1.7-3.1-2.1-5h4.2c-.4 1.9-1.2 3.7-2.1 5zm2.9-2a15 15 0 001.3-5h3.2a8 8 0 01-4.5 5z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 4h16v12H7l-3 3V4zm2 2v8h11V6H6z" />
        </svg>
      );
  }
}
