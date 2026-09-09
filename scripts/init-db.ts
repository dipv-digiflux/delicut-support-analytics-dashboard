import { getDb, closeMongo } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { getConfig } from "@/lib/config";

async function main() {
  const cfg = getConfig();
  console.log(`[init-db] connecting to ${cfg.MONGODB_URI} / ${cfg.MONGODB_DB}`);
  const db = await getDb();
  await ensureIndexes(db);
  const cols = await db.listCollections().toArray();
  console.log(
    `[init-db] ready — collections: ${cols.map((c) => c.name).join(", ") || "(empty, indexes created on first write)"}`,
  );
  console.log(
    "[init-db] indexes ensured on conversations, users, sync_windows, sync_runs, sync_campaigns, sync_state",
  );
}

main()
  .then(() => closeMongo())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("[init-db] failed:", err);
    await closeMongo().catch(() => undefined);
    process.exit(1);
  });
