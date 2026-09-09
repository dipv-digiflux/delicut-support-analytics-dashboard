import pc from "picocolors";
import { getConfig } from "@/lib/config";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(
    private runId: string | null = null,
    private format: "tty" | "json" = "tty",
  ) {}

  setRunId(id: string) {
    this.runId = id;
  }

  private shouldLog(level: Level): boolean {
    const cfg = getConfig();
    return LEVEL_ORDER[level] >= LEVEL_ORDER[cfg.LOG_LEVEL];
  }

  private emit(level: Level, message: string, extra?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    if (this.format === "json") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level,
          run_id: this.runId,
          message,
          ...extra,
        }),
      );
      return;
    }

    const prefix = this.runId ? `[sync ${this.runId.slice(0, 8)}]` : "[sync]";
    const colored =
      level === "error"
        ? pc.red(message)
        : level === "warn"
          ? pc.yellow(message)
          : level === "debug"
            ? pc.dim(message)
            : message;
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
  return new Logger(runId ?? null, format);
}
