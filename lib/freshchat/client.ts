import { getConfig, requireFreshchatConfig } from "@/lib/config";
import { FreshchatError, isFatalAuth } from "./errors";
import type { Logger } from "@/lib/log/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number): number {
  const j = ms * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(ms + j));
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  raw?: boolean;
  skipAuth?: boolean;
  logger?: Logger;
  onRateLimit?: () => void;
  onApiCall?: () => void;
}

export async function freshchatFetch<T = unknown>(
  pathOrUrl: string,
  opts: RequestOptions = {},
): Promise<T> {
  const cfg = opts.skipAuth ? getConfig() : requireFreshchatConfig();
  const base = (cfg.FRESHCHAT_API_BASE || "").replace(/\/$/, "");
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  let attempt = 0;
  const max = cfg.HTTP_MAX_RETRIES;

  while (true) {
    attempt++;
    opts.onApiCall?.();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? cfg.HTTP_TIMEOUT_MS,
    );

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts.headers || {}),
      };
      if (!opts.skipAuth && cfg.FRESHCHAT_API_TOKEN) {
        headers.Authorization = `Bearer ${cfg.FRESHCHAT_API_TOKEN}`;
      }
      if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      if (isFatalAuth(res.status)) {
        throw new FreshchatError(
          `Freshchat auth failed (${res.status}). Check FRESHCHAT_API_TOKEN.`,
          "AUTH_FAILED",
          res.status,
          true,
        );
      }

      if (res.status === 429) {
        opts.onRateLimit?.();
        const retryAfter = Number(res.headers.get("Retry-After") || "0");
        const wait =
          retryAfter > 0
            ? retryAfter * 1000
            : jitter(
                Math.min(
                  cfg.HTTP_BACKOFF_MAX_MS,
                  cfg.HTTP_BACKOFF_BASE_MS * 2 ** (attempt - 1),
                ),
              );
        opts.logger?.warn(`429 rate limited — waiting ${wait}ms (attempt ${attempt})`);
        if (attempt > max) {
          throw new FreshchatError("Rate limit exceeded", "RATE_LIMIT", 429);
        }
        await sleep(wait);
        continue;
      }

      if (res.status >= 500) {
        if (attempt > max) {
          throw new FreshchatError(
            `Freshchat 5xx after ${max} retries`,
            "SERVER_ERROR",
            res.status,
          );
        }
        const wait = jitter(
          Math.min(
            cfg.HTTP_BACKOFF_MAX_MS,
            cfg.HTTP_BACKOFF_BASE_MS * 2 ** (attempt - 1),
          ),
        );
        opts.logger?.warn(`5xx ${res.status} — retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new FreshchatError(
          `Freshchat ${res.status}: ${text.slice(0, 300)}`,
          "HTTP_ERROR",
          res.status,
        );
      }

      if (opts.raw) {
        return (await res.arrayBuffer()) as T;
      }

      if (res.status === 204) return undefined as T;
      const text = await res.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof FreshchatError) throw err;
      if (attempt > max) {
        throw new FreshchatError(
          err instanceof Error ? err.message : String(err),
          "NETWORK_ERROR",
        );
      }
      const wait = jitter(
        Math.min(
          cfg.HTTP_BACKOFF_MAX_MS,
          cfg.HTTP_BACKOFF_BASE_MS * 2 ** (attempt - 1),
        ),
      );
      opts.logger?.warn(`network error — retry in ${wait}ms: ${String(err)}`);
      await sleep(wait);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function downloadBinary(
  url: string,
  opts: RequestOptions = {},
): Promise<Buffer> {
  const cfg = getConfig();
  const ab = await freshchatFetch<ArrayBuffer>(url, {
    ...opts,
    skipAuth: true,
    raw: true,
    timeoutMs: cfg.HTTP_DOWNLOAD_TIMEOUT_MS,
  });
  return Buffer.from(ab);
}
