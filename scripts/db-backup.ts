#!/usr/bin/env node
/**
 * Full MongoDB dump of MONGODB_DB (mongodump).
 *
 * Usage:
 *   npm run db:backup
 *   npm run db:backup -- --out=backups/pre-reset
 *   npm run db:backup -- --no-gzip
 *
 * Requires MongoDB Database Tools (`mongodump` on PATH).
 * Restore later:
 *   mongorestore --uri="$MONGODB_URI" --nsInclude="$MONGODB_DB.*" --gzip --drop <dump-dir>
 *   # or without --gzip if you used --no-gzip
 */
import { spawnSync } from "child_process";
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

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function requireMongodump() {
  const check = spawnSync("mongodump", ["--version"], { encoding: "utf8" });
  if (check.error || check.status !== 0) {
    console.error(
      "[db:backup] `mongodump` not found. Install MongoDB Database Tools:",
    );
    console.error("  macOS:  brew install mongodb-database-tools");
    console.error(
      "  docs:   https://www.mongodb.com/docs/database-tools/installation/",
    );
    process.exit(1);
  }
}

async function main() {
  resetConfigCache();
  const cfg = getConfig();
  requireMongodump();

  const gzip = !has("no-gzip");
  const outArg = arg("out");
  const outDir = path.resolve(
    process.cwd(),
    outArg || path.join("backups", `${cfg.MONGODB_DB}-${stamp()}`),
  );

  fs.mkdirSync(outDir, { recursive: true });

  const db = await getDb();
  const cols = await db.listCollections().toArray();
  let totalDocs = 0;
  console.log(`[db:backup] ${cfg.MONGODB_URI} / ${cfg.MONGODB_DB}`);
  for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
    const n = await db.collection(c.name).estimatedDocumentCount();
    totalDocs += n;
    console.log(`  ${c.name}: ~${n.toLocaleString()} docs`);
  }
  console.log(
    `[db:backup] ${cols.length} collections, ~${totalDocs.toLocaleString()} docs → ${outDir}${gzip ? " (gzip)" : ""}`,
  );
  await closeMongo();

  const args = [
    `--uri=${cfg.MONGODB_URI}`,
    `--db=${cfg.MONGODB_DB}`,
    `--out=${outDir}`,
  ];
  if (gzip) args.push("--gzip");

  const result = spawnSync("mongodump", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());

  if (result.status !== 0) {
    console.error(`[db:backup] mongodump exited ${result.status}`);
    process.exit(result.status ?? 1);
  }

  const dumpRoot = path.join(outDir, cfg.MONGODB_DB);
  const size = dirSize(dumpRoot);
  console.log(
    `[db:backup] done — ${dumpRoot} (${formatBytes(size)})`,
  );
  console.log(
    `[db:backup] restore: mongorestore --uri="${cfg.MONGODB_URI}" --nsInclude="${cfg.MONGODB_DB}.*" ${gzip ? "--gzip " : ""}--drop "${dumpRoot}"`,
  );
}

function dirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

main().catch(async (err) => {
  console.error("[db:backup] failed:", err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
