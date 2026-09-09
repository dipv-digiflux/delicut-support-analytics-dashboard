import fs from "fs";
import path from "path";
import pc from "picocolors";
import { getConfig } from "@/lib/config";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Redact obvious secrets if they ever appear in log messages. */
function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***")
    .replace(/(api[_-]?token|password|secret)\s*[:=]\s*\S+/gi, "$1=***");
}

export class Logger {
  private fileStreams: fs.WriteStream[] = [];
  private logPaths: string[] = [];

  constructor(
    private runId: string | null = null,
    private format: "tty" | "json" = "tty",
    private fileEnabled = false,
  ) {}

  setRunId(id: string) {
    this.runId = id;
    if (this.fileEnabled) {
      this.openRunFile(id);
    }
  }

  /** Paths currently being written (for CLI tip). */
  getFilePaths(): string[] {
    return [...this.logPaths];
  }

  async close(): Promise<void> {
    await Promise.all(
      this.fileStreams.map(
        (s) =>
          new Promise<void>((resolve) => {
            s.end(() => resolve());
          }),
      ),
    );
    this.fileStreams = [];
  }

  private openDailyAndLatest() {
    const cfg = getConfig();
    const dir = path.resolve(process.cwd(), cfg.LOG_DIR);
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });

    const day = new Date().toISOString().slice(0, 10);
    const daily = path.join(dir, `sync-${day}.log`);
    const latest = path.join(dir, "sync-latest.log");

    this.attachFile(daily);
    // Fresh "latest" pointer each process (truncate)
    const latestStream = fs.createWriteStream(latest, { flags: "w" });
    this.fileStreams.push(latestStream);
    this.logPaths.push(latest);
  }

  private openRunFile(runId: string) {
    const cfg = getConfig();
    const dir = path.resolve(process.cwd(), cfg.LOG_DIR, "runs");
    fs.mkdirSync(dir, { recursive: true });
    const runPath = path.join(dir, `${runId}.log`);
    this.attachFile(runPath);
  }

  private attachFile(filePath: string) {
    if (this.logPaths.includes(filePath)) return;
    const stream = fs.createWriteStream(filePath, { flags: "a" });
    this.fileStreams.push(stream);
    this.logPaths.push(filePath);
  }

  enableFileLogging() {
    if (this.fileEnabled) return;
    this.fileEnabled = true;
    this.openDailyAndLatest();
    if (this.runId) this.openRunFile(this.runId);
  }

  private shouldLog(level: Level): boolean {
    const cfg = getConfig();
    return LEVEL_ORDER[level] >= LEVEL_ORDER[cfg.LOG_LEVEL];
  }

  private writeFile(
    level: Level,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    if (!this.fileStreams.length) return;
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        run_id: this.runId,
        message: sanitize(message),
        ...extra,
      }) + "\n";
    for (const s of this.fileStreams) {
      s.write(line);
    }
  }

  private emit(level: Level, message: string, extra?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;
    const safe = sanitize(message);

    this.writeFile(level, safe, extra);

    if (this.format === "json") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level,
          run_id: this.runId,
          message: safe,
          ...extra,
        }),
      );
      return;
    }

    const prefix = this.runId ? `[sync ${this.runId.slice(0, 8)}]` : "[sync]";
    const colored =
      level === "error"
        ? pc.red(safe)
        : level === "warn"
          ? pc.yellow(safe)
          : level === "debug"
            ? pc.dim(safe)
            : safe;
    console.log(`${pc.cyan(prefix)} ${colored}`);
  }

  debug(message: string, extra?: Record<string, unknown>) {
    this.emit("debug", message, extra);
  }
  info(message: string, extra?: Record<string, unknown>) {
    this.emit("info", message, extra);
  }
  warn(message: string, extra?: Record<string, unknown>) {
    this.emit("warn", message, extra);
  }
  error(message: string, extra?: Record<string, unknown>) {
    this.emit("error", message, extra);
  }
}

export function createLogger(runId?: string): Logger {
  const cfg = getConfig();
  const format =
    cfg.LOG_FORMAT === "json"
      ? "json"
      : cfg.LOG_FORMAT === "tty"
        ? "tty"
        : process.stdout.isTTY
          ? "tty"
          : "json";
  const logger = new Logger(runId ?? null, format, false);
  if (cfg.LOG_TO_FILE) {
    logger.enableFileLogging();
  }
  return logger;
}

/** Delete log files older than LOG_RETENTION_DAYS. */
export function pruneOldLogs(): { deleted: string[]; kept: number } {
  const cfg = getConfig();
  const dir = path.resolve(process.cwd(), cfg.LOG_DIR);
  const deleted: string[] = [];
  if (!fs.existsSync(dir)) return { deleted, kept: 0 };

  const cutoff = Date.now() - cfg.LOG_RETENTION_DAYS * 24 * 3600_000;
  let kept = 0;

  const walk = (folder: string) => {
    for (const name of fs.readdirSync(folder)) {
      const full = path.join(folder, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".log")) continue;
      if (name === "sync-latest.log") {
        kept++;
        continue;
      }
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        deleted.push(full);
      } else {
        kept++;
      }
    }
  };

  walk(dir);
  return { deleted, kept };
}
