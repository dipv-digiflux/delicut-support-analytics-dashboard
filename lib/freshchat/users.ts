import { freshchatFetch } from "./client";
import { getConfig } from "@/lib/config";
import type { Logger } from "@/lib/log/logger";

export interface FreshchatUserPayload {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  reference_id?: string | null;
  properties?: Array<{ name: string; value: string | number | boolean | null }>;
}

export async function fetchUsersByIds(
  ids: string[],
  opts: {
    logger?: Logger;
    onApiCall?: () => void;
    onRateLimit?: () => void;
  } = {},
): Promise<FreshchatUserPayload[]> {
  if (ids.length === 0) return [];
  const cfg = getConfig();
  const batchSize = cfg.USER_FETCH_BATCH_SIZE;
  const out: FreshchatUserPayload[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const res = await freshchatFetch<{ users?: FreshchatUserPayload[] } | FreshchatUserPayload[]>(
      "/users/fetch",
      {
        method: "POST",
        body: { ids: chunk },
        logger: opts.logger,
        onApiCall: opts.onApiCall,
        onRateLimit: opts.onRateLimit,
      },
    );

    if (Array.isArray(res)) {
      out.push(...res);
    } else if (res?.users) {
      out.push(...res.users);
    }
  }

  return out;
}
