#!/usr/bin/env node
/**
 * Wipe local analytics data (+ optional logs/cache) for a clean re-sync.
 * Usage:
 *   npm run db:reset -- --confirm=freshchat_analytics
 *   npm run db:reset -- --confirm=freshchat_analytics --logs --cache
 */
import fs from "fs";
import path from "path";
import { getConfig, resetConfigCache } from "@/lib/config";
import { closeMongo, getDb } from "@/lib/db/client";

function arg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function has(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  resetConfigCache();
  const cfg = getConfig();
  const confirm = arg("confirm");
  if (confirm !== cfg.MONGODB_DB) {
    console.error(
      `[db:reset] Refusing. Pass --confirm=${cfg.MONGODB_DB} to wipe this database.`,
    );
    process.exit(1);
  }

  const db = await getDb();
  console.log(`[db:reset] dropping database ${cfg.MONGODB_DB}…`);
  await db.dropDatabase();
  console.log("[db:reset] database dropped");

  if (has("logs")) {
    const dir = path.resolve(process.cwd(), cfg.LOG_DIR);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
      console.log(`[db:reset] cleared ${dir}`);
    }
  }

  if (has("cache")) {
    const dir = path.resolve(process.cwd(), cfg.EXTRACT_CACHE_DIR);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[db:reset] cleared ${dir}`);
    }
  }

  await closeMongo();
  console.log("[db:reset] done — run npm run db:init && npm run sync …");
}

main().catch(async (err) => {
  console.error(err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
