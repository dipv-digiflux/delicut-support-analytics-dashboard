# Environment variables

## Files (same keys, same order)

| File | Git | Role |
|------|-----|------|
| `.env.example` | committed | Template with placeholders |
| `.env` | ignored | Shared non-secrets; **empty** `FRESHCHAT_API_TOKEN` |
| `.env.local` | ignored | Local overrides; **put the API token here** |

Load order: `.env` then `.env.local` (overrides). Never commit tokens.

**Set these:**

| Variable | Purpose |
|----------|---------|
| `FRESHCHAT_API_BASE` | Freshchat API root `https://…/v2` |
| `FRESHCHAT_API_TOKEN` | Bearer token (`.env.local` only) |
| `MONGODB_URI` | Full Mongo URL **including the database name** in the path (`mongodb://127.0.0.1:27017/freshchat_analytics`). No separate `MONGODB_DB`. |
| `REPORTING_TIMEZONE` | Default timezone when URL has no `?tz=` (`Asia/Dubai`) |
| `DASHBOARD_ADMIN_USER` | Login username |
| `DASHBOARD_ADMIN_PASSWORD` | Login password (empty disables the gate) |
| `DATA_SHEET_URL` | `s3://bucket/key.xlsx` for sidebar **Download all data** |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM keys that can `s3:GetObject` on that file (`.env.local`) |
| `AWS_REGION` | Bucket region (`ap-south-1` default) |

**Optional overrides** (defaults live in `lib/config.ts` — uncomment in env only to change):

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_BRAND_NAME` / `APP_PRODUCT_NAME` | Delicut / Freshchat Support Analytics | Chrome branding |
| `DASHBOARD_API_SECRET` | _(empty)_ | Optional Bearer gate for scripts hitting `/api/*` |
| `DASHBOARD_SESSION_SECRET` | _(derived)_ | HMAC secret for session cookies |
| `CLASSIFY_ENABLED` | `false` | Keyword classify unlabeled chats |
| `SYNC_EVENTS` | (all core Extract events) | Which reports to sync |
| `LOG_LEVEL` / `LOG_TO_FILE` | `info` / `true` | Sync logging |

All other tunables (extract budgets, HTTP retries, page sizes, export caps, etc.) are **documented in `lib/config.ts`** with defaults — not required in env.

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
MONGODB_URI=mongodb://127.0.0.1:27017/freshchat_analytics
REPORTING_TIMEZONE=Asia/Dubai
DASHBOARD_ADMIN_USER=admin
DASHBOARD_ADMIN_PASSWORD=admin
DATA_SHEET_URL=s3://support-analytics-report/freshchat-20260914-1646.xlsx
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
```

When `DASHBOARD_ADMIN_PASSWORD` is set, visiting the app redirects to `/login`. Default local login: **admin / admin**. Sign out from the header.

## Private app (not for public listing)

This dashboard is internal analytics. Crawlers are blocked via:

- `robots: noindex, nofollow, noarchive` in page metadata
- `X-Robots-Tag` response header on all routes
- `/robots.txt` → `Disallow: /` (public on purpose so crawlers can read it)
- Empty `/sitemap.xml` (also public; not listed in robots.txt)
- Admin login gate (session cookie)

Do not submit the URL to Google Search Console or public directories.

See also [LOGGING.md](./LOGGING.md) and comments in [`.env.example`](../.env.example).
