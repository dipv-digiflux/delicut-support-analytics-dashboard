# Environment variables

## What belongs in `.env` / `.env.local`

**Keep here (secrets + DB):**

| Variable | Purpose |
|----------|---------|
| `FRESHCHAT_API_BASE` | Freshchat API root `https://…/v2` |
| `FRESHCHAT_API_TOKEN` | Bearer token |
| `MONGODB_URI` | Mongo connection |
| `MONGODB_DB` | Database name |

**Optional overrides** (defaults live in `lib/config.ts` — only set when you need to change them):

| Variable | Default | Purpose |
|----------|---------|---------|
| `REPORTING_TIMEZONE` | `Asia/Dubai` | Default timezone when URL has no `?tz=` |
| `APP_BRAND_NAME` / `APP_PRODUCT_NAME` | Delicut / Support Analytics | Chrome branding |
| `DASHBOARD_API_SECRET` | _(empty)_ | Optional Bearer gate for scripts hitting `/api/*` |
| `DASHBOARD_ADMIN_USER` | `admin` | Login username when password is set |
| `DASHBOARD_ADMIN_PASSWORD` | `admin` | When set, UI + APIs require admin login (cookie session) |
| `DASHBOARD_SESSION_SECRET` | _(derived)_ | HMAC secret for session cookies |
| `CLASSIFY_ENABLED` | `false` | Keyword classify unlabeled chats |
| `SYNC_EVENTS` | (all core Extract events) | Which reports to sync |
| `LOG_LEVEL` / `LOG_TO_FILE` | `info` / `true` | Sync logging |

All other tunables (extract budgets, HTTP retries, page sizes, export caps, etc.) are **documented in `lib/config.ts`** with defaults — not required in env.

Load order: `.env` then `.env.local` (overrides). Never commit tokens.

---

## Timezones (Dubai / IST / UTC)

- **Default:** Dubai (`Asia/Dubai`) via `REPORTING_TIMEZONE`.
- **UI:** Header dropdown switches **Dubai (GST)**, **India (IST)**, **UTC**.
- Choice is stored in `localStorage` (`delicut.timezone`) and URL `?tz=…`.
- **From/To date filters** are calendar days in the **selected** timezone (converted to UTC for Mongo).
- Timestamps in tables/chat should format with the same zone (`lib/timezone.ts` helpers).

---

## Minimal `.env.local`

```bash
FRESHCHAT_API_BASE=https://YOUR_DOMAIN.freshchat.com/v2
FRESHCHAT_API_TOKEN=paste_token_here
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=freshchat_analytics
REPORTING_TIMEZONE=Asia/Dubai
DASHBOARD_ADMIN_USER=admin
DASHBOARD_ADMIN_PASSWORD=admin
```

When `DASHBOARD_ADMIN_PASSWORD` is set, visiting the app redirects to `/login`. Default local login: **admin / admin**. Sign out from the header.

See also [LOGGING.md](./LOGGING.md) and comments in [`.env.example`](../.env.example).
