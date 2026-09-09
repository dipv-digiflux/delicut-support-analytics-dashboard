import { z } from "zod";
import { config as loadDotenv } from "dotenv";
import path from "path";

// Load .env first, then .env.local overrides (so filled local secrets win).
loadDotenv({ path: path.resolve(process.cwd(), ".env") });
loadDotenv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

export const ExtractEventSchema = z.enum([
  "Chat-Transcript",
  "CSAT-Score",
  "Conversation-Resolution-Label",
  "Conversation-Created",
  "Conversation-Resolved",
  "First-Response-Time",
  "Resolution-Time",
  "Response-Time",
  "Message-Sent",
]);

const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true")
  .default(false);

const ConfigSchema = z.object({
  FRESHCHAT_API_BASE: z
    .string()
    .optional()
    .default("")
    // Freshchat rejects http:// with 401; always prefer https
    .transform((v) => v.replace(/^http:\/\//i, "https://")),
  FRESHCHAT_API_TOKEN: z.string().optional().default(""),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017"),
  MONGODB_DB: z.string().default("freshchat_analytics"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
  MONGODB_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SYNC_LOOKBACK_DAYS: z.coerce.number().int().positive().default(30),
  SYNC_TRANSCRIPT_OVERLAP_HOURS: z.coerce.number().int().positive().default(24),
  SYNC_CSAT_OVERLAP_DAYS: z.coerce.number().int().positive().default(2),
  SYNC_LABEL_OVERLAP_DAYS: z.coerce.number().int().positive().default(2),
  SYNC_EVENTS: z.string().default(
    "Chat-Transcript,CSAT-Score,Conversation-Resolution-Label,Conversation-Created,Conversation-Resolved,First-Response-Time,Resolution-Time",
  ),
  EXTRACT_MIN_POST_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  EXTRACT_MAX_JOBS_PER_DAY: z.coerce.number().int().positive().default(120),
  EXTRACT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(20000),
  EXTRACT_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(4500000),
  EXTRACT_CACHE_DIR: z.string().default(".cache/extracts"),
  HTTP_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  HTTP_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(1000),
  HTTP_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(60000),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  HTTP_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  BULK_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  MAX_EMBEDDED_MESSAGES: z.coerce.number().int().positive().default(500),
  USER_FETCH_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  USER_ENRICH_MAX_PER_RUN: z.coerce.number().int().positive().default(1000),
  USER_REFRESH_DAYS: z.coerce.number().int().positive().default(30),
  CLASSIFY_ENABLED: boolish,
  CLASSIFIER_VERSION: z.string().default("kw-v1"),
  CLASSIFY_MESSAGE_WINDOW: z.coerce.number().int().positive().default(5),
  CLASSIFY_MIN_SCORE: z.coerce.number().int().positive().default(3),
  CLASSIFY_LLM_ENABLED: boolish,
  APP_BRAND_NAME: z.string().default("Delicut"),
  APP_PRODUCT_NAME: z.string().default("Support Analytics"),
  REPORTING_TIMEZONE: z.string().default("Asia/Dubai"),
  SYNC_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(60),
  DASHBOARD_DEFAULT_RANGE_DAYS: z.coerce.number().int().positive().default(30),
  UI_DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(25),
  DIRECTORY_SEARCH_LIMIT: z.coerce.number().int().positive().default(40),
  CUSTOMER_CHAT_PAGE_SIZE: z.coerce.number().int().positive().default(50),
  EXPORT_CSV_MAX_ROWS: z.coerce.number().int().positive().default(10000),
  DASHBOARD_API_SECRET: z.string().optional().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["auto", "tty", "json"]).default("auto"),
  LOG_TO_FILE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) =>
      v === undefined || v === null || v === ""
        ? true
        : v === true || v === "true",
    ),
  LOG_DIR: z.string().default("logs"),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  syncEvents: z.infer<typeof ExtractEventSchema>[];
  hasFreshchatCredentials: boolean;
};

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  const data = parsed.data;
  const syncEvents = data.SYNC_EVENTS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((e) => ExtractEventSchema.parse(e));

  const base = (data.FRESHCHAT_API_BASE || "").replace(/\/$/, "");
  cached = {
    ...data,
    FRESHCHAT_API_BASE: base,
    CLASSIFY_ENABLED: Boolean(data.CLASSIFY_ENABLED),
    CLASSIFY_LLM_ENABLED: Boolean(data.CLASSIFY_LLM_ENABLED),
    LOG_TO_FILE: Boolean(data.LOG_TO_FILE),
    syncEvents,
    hasFreshchatCredentials: Boolean(
      data.FRESHCHAT_API_TOKEN && base && !base.includes("your-domain"),
    ),
  };

  return cached;
}

export function requireFreshchatConfig(): AppConfig {
  const cfg = getConfig();
  if (!cfg.hasFreshchatCredentials) {
    throw new Error(
      "Missing Freshchat credentials. Set FRESHCHAT_API_BASE and FRESHCHAT_API_TOKEN in .env.local — see docs/ENV.md",
    );
  }
  return cfg;
}

/** Clear cache (tests / scripts that reload env). */
export function resetConfigCache() {
  cached = null;
}
