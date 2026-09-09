"use client";

import { useState } from "react";
import { MediaModal, type MediaItem } from "@/components/ui/MediaModal";

function isAudio(a: MediaItem) {
  return (
    a.kind === "audio" ||
    Boolean(a.mime_type?.startsWith("audio/")) ||
    /\.(ogg|mp3|wav|m4a|aac|opus)$/i.test(a.file_name || a.url || "")
  );
}

function isImage(a: MediaItem) {
  return (
    a.kind === "image" ||
    Boolean(a.mime_type?.startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.file_name || a.url || "")
  );
}

function isVideo(a: MediaItem) {
  return (
    a.kind === "video" ||
    Boolean(a.mime_type?.startsWith("video/")) ||
    /\.(mp4|webm|mov)$/i.test(a.file_name || a.url || "")
  );
}

/** Inline attachment: listen/play audio-video, open images in modal. */
export function AttachmentBlock({
  attachments,
}: {
  attachments: MediaItem[];
}) {
  const [modal, setModal] = useState<MediaItem | null>(null);

  if (!attachments.length) return null;

  return (
    <div className="mt-1 space-y-2">
      {attachments.map((a, i) => {
        const url = a.url || a.thumbnail_url;
        if (url && isAudio(a)) {
          return (
            <div
              key={i}
              className="rounded-lg bg-black/5 px-2 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 text-[10px] font-medium text-[var(--muted)]">
                🔊 {a.file_name || "Voice / audio"}
              </div>
              <audio src={url} controls preload="metadata" className="w-full" />
            </div>
          );
        }
        if (url && isVideo(a)) {
          return (
            <div key={i} className="overflow-hidden rounded-lg">
              <video
                src={url}
                controls
                preload="metadata"
                className="max-h-48 w-full rounded-lg"
              />
            </div>
          );
        }
        if (url && isImage(a)) {
          return (
            <button
              key={i}
              type="button"
              className="block w-full text-left"
              onClick={() => setModal(a)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={a.file_name || "image"}
                className="max-h-40 rounded-lg hover:opacity-90"
              />
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            className="flex w-full items-center gap-2 rounded-lg bg-black/5 px-2 py-1.5 text-left text-xs hover:bg-black/10"
            onClick={() => setModal(a)}
          >
            <span>📎</span>
            <span className="truncate">
              {a.file_name || a.kind || "Attachment"}
              {!url && " (no URL)"}
            </span>
          </button>
        );
      })}
      {modal && <MediaModal item={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
