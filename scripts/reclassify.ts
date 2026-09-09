import { collections, closeMongo } from "@/lib/db/client";
import { classifyPending } from "@/lib/sync/classify-phase";
import { emptyCounters } from "@/lib/db/types";
import { createLogger } from "@/lib/log/logger";
import { getConfig } from "@/lib/config";

async function main() {
  getConfig();
  const logger = createLogger();
  const counters = emptyCounters();
  // Force reclassify by clearing derived.classifier_version mismatch via nulling
  if (process.argv.includes("--force")) {
    const { conversations } = await collections();
    await conversations.updateMany({}, { $set: { derived: null } });
    logger.info("cleared derived subjects — reclassifying all");
  }
  await classifyPending(counters, logger);
  logger.info(
    `done classified=${counters.classified} reclassified=${counters.reclassified}`,
  );
}

main()
  .then(() => closeMongo())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await closeMongo().catch(() => undefined);
    process.exit(1);
  });
