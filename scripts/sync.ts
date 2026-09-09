import { runSync, shutdownSync } from "@/lib/sync/run";
import type { ExtractEvent } from "@/lib/db/types";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const lookback = arg("lookback");
  const since = arg("since");
  const until = arg("until");
  const mode = (arg("mode") as "backfill" | "incremental" | "repair") || undefined;
  const eventsRaw = arg("events");

  const run = await runSync({
    mode,
    lookbackDays: lookback ? Number(lookback) : undefined,
    since: since ? new Date(since) : null,
    until: until ? new Date(until) : null,
    dryRun: hasFlag("dry-run"),
    force: hasFlag("force"),
    events: eventsRaw
      ? (eventsRaw.split(",") as ExtractEvent[])
      : undefined,
  });

  await shutdownSync();
  process.exit(run.status === "failed" ? 1 : 0);
}

main().catch(async (err) => {
  console.error("[sync] fatal:", err);
  await shutdownSync().catch(() => undefined);
  process.exit(1);
});
