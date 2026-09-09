"use client";

import { useEffect, useId } from "react";

export type MediaItem = {
  kind: string;
  url: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  thumbnail_url?: string | null;
};

export function MediaModal({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const url = item.url || item.thumbnail_url;
  const isImage =
    item.kind === "image" ||
    Boolean(item.mime_type?.startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(item.file_name || url || "");
  const isVideo =
    item.kind === "video" ||
    Boolean(item.mime_type?.startsWith("video/")) ||
    /\.(mp4|webm|mov)$/i.test(item.file_name || url || "");
  const isAudio =
    item.kind === "audio" ||
    Boolean(item.mime_type?.startsWith("audio/")) ||
    /\.(ogg|mp3|wav|m4a|aac)$/i.test(item.file_name || url || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id={titleId} className="truncate text-sm font-semibold">
            {item.file_name || item.kind || "Attachment"}
          </h2>
          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-[var(--border)] px-2 py-1 text-xs"
              >
                Open
              </a>
            )}
            <button
              type="button"
              className="rounded bg-[var(--brand)] px-2 py-1 text-xs text-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex min-h-[200px] items-center justify-center bg-black p-4">
          {!url && (
            <p className="text-sm text-white/70">No URL in extract data</p>
          )}
          {url && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={item.file_name || "attachment"}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
          {url && isVideo && (
            <video src={url} controls className="max-h-[75vh] max-w-full" />
          )}
          {url && isAudio && (
            <audio src={url} controls className="w-full" />
          )}
          {url && !isImage && !isVideo && !isAudio && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-white px-4 py-2 text-sm font-medium text-[var(--brand)]"
            >
              Download / open file
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
