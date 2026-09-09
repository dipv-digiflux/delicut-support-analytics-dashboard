#!/usr/bin/env node
import { pruneOldLogs } from "@/lib/log/logger";
import { getConfig } from "@/lib/config";
import fs from "fs";
import path from "path";

async function main() {
  const cfg = getConfig();
  const dir = path.resolve(process.cwd(), cfg.LOG_DIR);
  console.log(`[logs] dir=${dir} retention=${cfg.LOG_RETENTION_DAYS}d`);

  if (process.argv.includes("--list")) {
    if (!fs.existsSync(dir)) {
      console.log("[logs] (empty — no logs yet)");
      return;
    }
    const walk = (folder: string, prefix = "") => {
      for (const name of fs.readdirSync(folder).sort()) {
        const full = path.join(folder, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          console.log(`${prefix}${name}/`);
          walk(full, prefix + "  ");
        } else {
          const kb = (st.size / 1024).toFixed(1);
          console.log(
            `${prefix}${name}  ${kb}KB  ${st.mtime.toISOString()}`,
          );
        }
      }
    };
    walk(dir);
    return;
  }

  const result = pruneOldLogs();
  console.log(
    `[logs] pruned ${result.deleted.length} file(s), kept ${result.kept}`,
  );
  for (const f of result.deleted) console.log(`  - deleted ${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
