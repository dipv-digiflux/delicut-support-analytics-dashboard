import { freshchatFetch, downloadBinary } from "./client";
import { acquireExtractSlot } from "./budget";
import { FreshchatError } from "./errors";
import type { ExtractEvent } from "@/lib/db/types";
import type { Logger } from "@/lib/log/logger";
import { getConfig } from "@/lib/config";
import { unwrapExtractCsv } from "@/lib/parse/extract-buffer";

export interface SubmitJobResult {
  id: string;
  href: string;
}

export interface PollJobResult {
  id: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | string;
  links: {
    href: string;
    from_date?: string;
    to_date?: string;
    status?: string;
  }[];
}

export async function submitExtractJob(
  event: ExtractEvent,
  start: Date,
  end: Date,
  opts: {
    logger?: Logger;
    onApiCall?: () => void;
    onRateLimit?: () => void;
  } = {},
): Promise<SubmitJobResult> {
  const slot = await acquireExtractSlot(event);
  if (!slot.ok) {
    throw new FreshchatError(slot.reason || "quota", "QUOTA_EXHAUSTED");
  }

  opts.logger?.info(
    `requesting ${event} export ${start.toISOString()} → ${end.toISOString()}`,
  );

  const res = await freshchatFetch<{
    id: string;
    link?: { href?: string };
  }>("/reports/raw", {
    method: "POST",
    body: {
      start: start.toISOString(),
      end: end.toISOString(),
      event,
      format: "csv",
    },
    logger: opts.logger,
    onApiCall: opts.onApiCall,
    onRateLimit: opts.onRateLimit,
  });

  if (!res?.id) {
    throw new FreshchatError("Extract POST returned no job id", "NO_JOB_ID");
  }

  return {
    id: res.id,
    href: res.link?.href || `/reports/raw/${res.id}`,
  };
}

export async function pollExtractJob(
  jobId: string,
  opts: {
    logger?: Logger;
    onApiCall?: () => void;
    onRateLimit?: () => void;
    signal?: { aborted: boolean };
  } = {},
): Promise<PollJobResult> {
  const cfg = getConfig();
  const started = Date.now();
  let attempt = 0;

  while (true) {
    if (opts.signal?.aborted) {
      throw new FreshchatError("Aborted while polling", "ABORTED");
    }
    if (Date.now() - started > cfg.EXTRACT_JOB_TIMEOUT_MS) {
      throw new FreshchatError(
        `Job ${jobId} timed out after ${cfg.EXTRACT_JOB_TIMEOUT_MS}ms`,
        "JOB_TIMEOUT",
      );
    }

    attempt++;
    const res = await freshchatFetch<{
      id: string;
      status: string;
      links?: Array<{
        link?: { href?: string };
        from_date?: string;
        to_date?: string;
        status?: string;
      }>;
    }>(`/reports/raw/${jobId}`, {
      logger: opts.logger,
      onApiCall: opts.onApiCall,
      onRateLimit: opts.onRateLimit,
    });

    const status = (res.status || "PENDING").toUpperCase();
    opts.logger?.debug(
      `job ${jobId}: polling (attempt ${attempt}, status=${status})`,
    );

    if (status === "FAILED") {
      throw new FreshchatError(`Job ${jobId} FAILED`, "JOB_FAILED");
    }

    if (status === "COMPLETED") {
      const links = (res.links || [])
        .map((l) => ({
          href: l.link?.href || "",
          from_date: l.from_date,
          to_date: l.to_date,
          status: l.status,
        }))
        .filter((l) => l.href);

      opts.logger?.info(
        `job ${jobId}: COMPLETED (${links.length} download link(s))`,
      );
      return { id: jobId, status, links };
    }

    await new Promise((r) => setTimeout(r, cfg.EXTRACT_POLL_INTERVAL_MS));
  }
}

export async function downloadExtractCsv(
  links: { href: string }[],
  opts: {
    logger?: Logger;
    onApiCall?: () => void;
    onRateLimit?: () => void;
    repoll?: () => Promise<PollJobResult>;
  } = {},
): Promise<Buffer> {
  const csvTexts: string[] = [];

  for (const link of links) {
    try {
      const buf = await downloadBinary(link.href, {
        logger: opts.logger,
        onApiCall: opts.onApiCall,
        onRateLimit: opts.onRateLimit,
      });
      // Freshchat often serves a ZIP that wraps the CSV
      const csv = unwrapExtractCsv(buf).toString("utf8");
      csvTexts.push(csv);
    } catch (err) {
      if (
        err instanceof FreshchatError &&
        err.status === 403 &&
        opts.repoll
      ) {
        opts.logger?.warn("download link expired — re-polling job");
        const refreshed = await opts.repoll();
        return downloadExtractCsv(refreshed.links, {
          ...opts,
          repoll: undefined,
        });
      }
      throw err;
    }
  }

  if (csvTexts.length <= 1) {
    return Buffer.from(csvTexts[0] || "", "utf8");
  }

  const merged: string[] = [];
  for (let i = 0; i < csvTexts.length; i++) {
    const lines = csvTexts[i].replace(/^\uFEFF/, "").split(/\r?\n/);
    if (i === 0) merged.push(...lines);
    else merged.push(...lines.slice(1));
  }
  return Buffer.from(merged.join("\n"), "utf8");
}
