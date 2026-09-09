# Environment variables — what each one is for

Copy [`.env.example`](../.env.example) → `.env.local` and fill Freshchat secrets.  
**Never commit real tokens.** Load order: `.env` then `.env.local` (overrides).

All tunables below are read via `lib/config.ts` (`getConfig()`).  
**API + DB credentials stay in env** (not hardcoded).

---

## Freshchat API (required for sync)

| Variable | Used for |
|----------|----------|
| `FRESHCHAT_API_BASE` | Account API root `https://…freshchat.com/v2` (HTTP coerced to HTTPS) |
| `FRESHCHAT_API_TOKEN` | Bearer token for Extract + Agents/Users APIs |

## MongoDB

| Variable | Used for |
|----------|----------|
| `MONGODB_URI` / `MONGODB_DB` | Local warehouse connection |
| `MONGODB_MAX_POOL_SIZE` / `MONGODB_TIMEOUT_MS` | Pool + connect timeout |

## Sync / Extract / HTTP / enrichment / classify

See commented blocks in `.env.example` — each maps 1:1 to `getConfig()` fields used by `lib/sync/*` and `lib/freshchat/*`.

## Dashboard / UI product

| Variable | Used for |
|----------|----------|
| `APP_BRAND_NAME` | Sidebar + header brand (default `Delicut`) |
| `APP_PRODUCT_NAME` | Subtitle (default `Support Analytics`) |
| `REPORTING_TIMEZONE` | Display label only (filters stay UTC days) |
| `SYNC_STALE_AFTER_MINUTES` | “Stale sync” badge threshold |
| `DASHBOARD_DEFAULT_RANGE_DAYS` | Default `from`/`to` when URL has no dates |
| `UI_DEFAULT_PAGE_SIZE` | Default list page size (10/25/40/50/100) |
| `DIRECTORY_SEARCH_LIMIT` | Agent/customer/channel directory API page size |
| `CUSTOMER_CHAT_PAGE_SIZE` | Messages per scroll page on user chat history |
| `EXPORT_CSV_MAX_ROWS` | CSV export row cap + truncation headers |
| `DASHBOARD_API_SECRET` | Optional Bearer gate on `/api/*` (empty = open locally) |

## Logging

| Variable | Used for |
|----------|----------|
| `LOG_TO_FILE` / `LOG_DIR` / `LOG_RETENTION_DAYS` | File logs under `logs/` |
| `LOG_LEVEL` / `LOG_FORMAT` | Console verbosity + tty/json |

See [LOGGING.md](./LOGGING.md).

---

## Minimal secrets-only `.env.local`

```bash
FRESHCHAT_API_BASE=https://YOUR_DOMAIN.freshchat.com/v2
FRESHCHAT_API_TOKEN=paste_token_here
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=freshchat_analytics
```

Everything else can stay at `.env.example` defaults (or full copy with comments).
