# Freshchat Analytics Dashboard

Pulls **Freshchat Extract reports as-is** into local MongoDB and serves analytics UI.  
We do **not** invent CSAT, labels, or rewrite transcripts — optional keyword classify is **off** by default.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/ENV.md](./docs/ENV.md) | **What each `.env` variable means** |
| [docs/DASHBOARD_KPIS.md](./docs/DASHBOARD_KPIS.md) | **Dashboard data sources & KPI definitions** |
| [docs/FRESHCHAT_ADMIN_CHECKLIST.md](./docs/FRESHCHAT_ADMIN_CHECKLIST.md) | Freshchat admin setup |
| [docs/BUILD_PLAN.md](./docs/BUILD_PLAN.md) | Architecture / phases |
| [docs/SYNC.md](./docs/SYNC.md) | Sync / ledger notes |

## Setup

```bash
# 1. Credentials — edit .env.local (see docs/ENV.md)
FRESHCHAT_API_BASE=https://YOUR_DOMAIN.freshchat.com/v2
FRESHCHAT_API_TOKEN=...

# 2. Mongo running locally (or: docker compose up -d)
npm install
npm run db:init

# 3. Pull this year’s data (resumable; may take multiple days due to Extract quota)
npm run sync:year

# 4. UI
npm run dev
```

- Dashboard: http://localhost:3000/dashboard  
- Raw table + CSV export: http://localhost:3000/conversations  
- Chat detail (Freshchat-style): http://localhost:3000/conversations/[id]

## Data policy

- Stored fields come from Freshchat CSV/API (`rating_raw`, resolution labels, message `raw` columns, SLA seconds).
- `CLASSIFY_ENABLED=false` → subject = Freshchat resolution label only (empty if unlabeled).
- Upserts by Freshchat IDs — re-sync updates, never duplicates.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run sync:year` | Backfill from Jan 1 of current year |
| `npm run sync -- --lookback=3` | Short test sync |
| `npm run sync -- --since=2026-01-01` | Custom since date |
| `npm run verify` | Integrity checks |
