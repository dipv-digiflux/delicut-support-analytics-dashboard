import { z } from "zod";
import { config as loadDotenv } from "dotenv";
import path from "path";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

// Load .env first, then .env.local overrides (local secrets win).
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

/**
 * App configuration.
 *
 * Put secrets + DB in `.env` / `.env.local`.
 * Everything else has safe defaults here — only set in env when you need to override.
 *
 * See docs/ENV.md for the lean env list vs these defaults.
 */
const ConfigSchema = z.object({
  // --- Secrets / connections (from env) ---
  /** Freshchat API root, e.g. https://account.freshchat.com/v2 */
  FRESHCHAT_API_BASE: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/^http:\/\//i, "https://")),
  /** Freshchat Bearer token (Admin → API Tokens) */
  FRESHCHAT_API_TOKEN: z.string().optional().default(""),
  /** Mongo connection string */
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017"),
  /** Mongo database name for analytics warehouse */
  MONGODB_DB: z.string().default("freshchat_analytics"),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
  MONGODB_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // --- Product / UI (defaults; optional env override) ---
  /** Sidebar + document title brand */
  APP_BRAND_NAME: z.string().default("Delicut"),
  /** Product subtitle under brand */
  APP_PRODUCT_NAME: z.string().default("Support Analytics"),
  /**
   * Default reporting timezone when URL/localStorage has no `tz`.
   * UI dropdown: Asia/Dubai | Asia/Kolkata | UTC
   */
  REPORTING_TIMEZONE: z.string().default(DEFAULT_TIMEZONE),
  /** Minutes without a completed sync before UI shows “stale” */
  SYNC_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(60),
  /** Default From/To window length (days) when URL has no dates */
  DASHBOARD_DEFAULT_RANGE_DAYS: z.coerce.number().int().positive().default(30),
  /** Default rows-per-page for tables */
  UI_DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(25),
  /** Max hits from agent/customer/channel directory APIs */
  DIRECTORY_SEARCH_LIMIT: z.coerce.number().int().positive().default(40),
  /** Messages per page in customer chat history */
  CUSTOMER_CHAT_PAGE_SIZE: z.coerce.number().int().positive().default(50),
  /** Soft cap for CSV export rows */
  EXPORT_CSV_MAX_ROWS: z.coerce.number().int().positive().default(10000),
  /** Optional Bearer secret for /api/* (empty = cookie session only) */
  DASHBOARD_API_SECRET: z.string().optional().default(""),
  /**
   * Admin login for the UI. When password is non-empty, middleware requires
   * a signed session cookie (pages + APIs). Leave password empty only for
   * open local prototyping — not for shared/staging/prod.
   */
  DASHBOARD_ADMIN_USER: z.string().optional().default("admin"),
  /** Empty disables the login gate. Default `admin` for local locked dashboard. */
  DASHBOARD_ADMIN_PASSWORD: z.string().optional().default("admin"),
  /** HMAC secret for session cookies (falls back to password-derived) */
  DASHBOARD_SESSION_SECRET: z.string().optional().default(""),

  // --- Sync (defaults; override only if needed) ---
  /** First-run lookback when no cursor exists */
  SYNC_LOOKBACK_DAYS: z.coerce.number().int().positive().default(30),
  SYNC_TRANSCRIPT_OVERLAP_HOURS: z.coerce.number().int().positive().default(24),
  SYNC_CSAT_OVERLAP_DAYS: z.coerce.number().int().positive().default(2),
  SYNC_LABEL_OVERLAP_DAYS: z.coerce.number().int().positive().default(2),
  /** Comma-separated Extract event names */
  SYNC_EVENTS: z.string().default(
    "Chat-Transcript,CSAT-Score,Conversation-Resolution-Label,Conversation-Created,Conversation-Resolved,First-Response-Time,Resolution-Time",
  ),

  // --- Extract API budget ---
  EXTRACT_MIN_POST_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  EXTRACT_MAX_JOBS_PER_DAY: z.coerce.number().int().positive().default(120),
  EXTRACT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(20000),
  EXTRACT_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(4500000),
  EXTRACT_CACHE_DIR: z.string().default(".cache/extracts"),
  /** Max Extract attempts per window before giving up until --force */
  SYNC_WINDOW_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Within one run, immediately retry failed windows (uses remaining quota) */
  SYNC_RETRY_FAILED_IN_RUN: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) =>
      v === undefined || v === null || v === ""
        ? true
        : v === true || v === "true",
    ),

  // --- HTTP client ---
  HTTP_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  HTTP_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(1000),
  HTTP_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(60000),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  HTTP_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),

  // --- Storage shaping ---
  BULK_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  MAX_EMBEDDED_MESSAGES: z.coerce.number().int().positive().default(500),
  USER_FETCH_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  USER_ENRICH_MAX_PER_RUN: z.coerce.number().int().positive().default(1000),
  USER_REFRESH_DAYS: z.coerce.number().int().positive().default(30),

  // --- Classification (off = Freshchat labels only) ---
  CLASSIFY_ENABLED: boolish,
  CLASSIFIER_VERSION: z.string().default("kw-v1"),
  CLASSIFY_MESSAGE_WINDOW: z.coerce.number().int().positive().default(5),
  CLASSIFY_MIN_SCORE: z.coerce.number().int().positive().default(3),
  CLASSIFY_LLM_ENABLED: boolish,

  // --- Logging ---
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
