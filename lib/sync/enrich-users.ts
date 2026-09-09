import { collections } from "@/lib/db/client";
import { getConfig } from "@/lib/config";
import { fetchUsersByIds } from "@/lib/freshchat/users";
import { userHash } from "@/lib/hash/entity-hash";
import type { SyncRunCounters, User } from "@/lib/db/types";
import type { DiscoveredActor } from "./merge/transcripts";
import type { Logger } from "@/lib/log/logger";
import type { AnyBulkWriteOperation } from "mongodb";

export async function upsertDiscoveredUsers(
  discovered: DiscoveredActor[],
  counters: SyncRunCounters,
): Promise<void> {
  if (!discovered.length) return;
  const { users } = await collections();
  const now = new Date();
  const ops: AnyBulkWriteOperation<User>[] = [];

  for (const d of discovered) {
    ops.push({
      updateOne: {
        filter: { _id: d.id },
        update: {
          $set: {
            role: d.role,
            updated_at: now,
          },
          // Use dotted paths only — Mongo rejects $max("stats.x") + $setOnInsert(stats:{...}) together
          $min: { "stats.first_seen_at": d.last_seen_at },
          $max: { "stats.last_seen_at": d.last_seen_at },
          $setOnInsert: {
            first_name: d.name?.split(" ")[0] || null,
            last_name: d.name?.split(" ").slice(1).join(" ") || null,
            email: null,
            phone: null,
            reference_id: null,
            properties: {},
            enrichment: {
              status: "pending",
              hash: null,
              fetched_at: null,
              attempts: 0,
              last_error: null,
            },
            "stats.conversation_count": 0,
          },
        },
        upsert: true,
      },
    });
  }

  const cfg = getConfig();
  for (let i = 0; i < ops.length; i += cfg.BULK_BATCH_SIZE) {
    const chunk = ops.slice(i, i + cfg.BULK_BATCH_SIZE);
    const res = await users.bulkWrite(chunk, { ordered: false });
    counters.users_discovered += res.upsertedCount;
  }
}

export async function enrichUsers(
  counters: SyncRunCounters,
  logger: Logger,
): Promise<void> {
  const cfg = getConfig();
  const { users } = await collections();
  const refreshBefore = new Date(
    Date.now() - cfg.USER_REFRESH_DAYS * 24 * 3600_000,
  );

  const queue = await users
    .find({
      role: "user",
      $or: [
        { "enrichment.status": { $in: ["pending", "error"] }, "enrichment.attempts": { $lt: 3 } },
        {
          "enrichment.status": "ok",
          "enrichment.fetched_at": { $lte: refreshBefore },
        },
      ],
    })
    .sort({ "stats.first_seen_at": 1 })
    .limit(cfg.USER_ENRICH_MAX_PER_RUN)
    .project({ _id: 1, enrichment: 1 })
    .toArray();

  if (!queue.length) {
    logger.info("users: nothing to enrich");
    return;
  }

  logger.info(`users: enriching ${queue.length}`);
  const ids = queue.map((u) => u._id);
  const fetched = await fetchUsersByIds(ids, {
    logger,
    onApiCall: () => {
      counters.api_calls++;
    },
    onRateLimit: () => {
      counters.rate_limit_waits++;
    },
  });

  const byId = new Map(fetched.map((u) => [u.id, u]));
  const now = new Date();

  for (const id of ids) {
    const payload = byId.get(id);
    if (!payload) {
      await users.updateOne(
        { _id: id },
        {
          $set: {
            "enrichment.status": "not_found",
            "enrichment.last_error": "not returned by /users/fetch",
            updated_at: now,
          },
          $inc: { "enrichment.attempts": 1 },
        },
      );
      continue;
    }

    const properties: Record<string, string | number | boolean | null> = {};
    for (const p of payload.properties || []) {
      properties[p.name] = p.value ?? null;
    }

    const hash = userHash({
      user_id: id,
      first_name: payload.first_name || null,
      last_name: payload.last_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      reference_id: payload.reference_id || null,
      properties,
    });

    const existing = await users.findOne(
      { _id: id },
      { projection: { enrichment: 1 } },
    );
    if (existing?.enrichment?.hash === hash) {
      await users.updateOne(
        { _id: id },
        {
          $set: {
            "enrichment.status": "ok",
            "enrichment.fetched_at": now,
            updated_at: now,
          },
        },
      );
      continue;
    }

    await users.updateOne(
      { _id: id },
      {
        $set: {
          first_name: payload.first_name || null,
          last_name: payload.last_name || null,
          email: payload.email || null,
          phone: payload.phone || null,
          reference_id: payload.reference_id || null,
          properties,
          enrichment: {
            status: "ok",
            hash,
            fetched_at: now,
            attempts: existing?.enrichment?.attempts || 0,
            last_error: null,
          },
          updated_at: now,
        },
      },
    );
    counters.users_enriched++;
  }
}
