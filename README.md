# Freshchat Analytics Dashboard

Pulls **Freshchat Extract reports as-is** into local MongoDB and serves analytics UI.  
We do **not** invent CSAT, labels, or rewrite transcripts. Keyword classify writes `derived` only (never Freshchat tags). `/outcomes` is chat-risk language until analytics MySQL; `/sales` is Phone-ZIWO chats until a ZIWO ingest.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/HOW_IT_WORKS.md](./docs/HOW_IT_WORKS.md) | **Start here — screens, numbers, classify, what we are not measuring** |
| [docs/DATA_FLOW.md](./docs/DATA_FLOW.md) | Freshchat → us flow; Extract vs webhooks (live push) |
| [docs/DATA_ARCHITECTURE.md](./docs/DATA_ARCHITECTURE.md) | **How we get data, what we store, architecture** |
| [docs/ENV.md](./docs/ENV.md) | **What each `.env` variable means** |
| [docs/DASHBOARD_KPIS.md](./docs/DASHBOARD_KPIS.md) | **Dashboard data sources & KPI definitions** |
| [docs/REVIEW_FIXES.md](./docs/REVIEW_FIXES.md) | Deep review findings & what we fixed |
| [docs/FRESHCHAT_ADMIN_CHECKLIST.md](./docs/FRESHCHAT_ADMIN_CHECKLIST.md) | Freshchat admin setup |
| [docs/BUILD_PLAN.md](./docs/BUILD_PLAN.md) | Architecture / phases |
| [docs/SYNC.md](./docs/SYNC.md) | Sync / ledger notes |
| [docs/LOGGING.md](./docs/LOGGING.md) | Sync log files, prune, retention |

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

- How it works: http://localhost:3000/how-it-works
- Dashboard: http://localhost:3000/dashboard
- Raw table + CSV export: http://localhost:3000/conversations
- Chat detail (Freshchat-style): http://localhost:3000/conversations/[id]
- Chat risk (not true churn): http://localhost:3000/outcomes
- Phone Sales (Phone-ZIWO chats until ZIWO ingest): http://localhost:3000/sales
- Data flow: http://localhost:3000/data-flow

## Data policy

- Stored fields come from Freshchat CSV/API (`rating_raw`, resolution labels, message `raw` columns, SLA seconds).
- `CLASSIFY_ENABLED=true` → unlabeled chats get a keyword `derived.subject`; **Label coverage** stays Freshchat tags.
- Upserts by Freshchat IDs — re-sync updates, never duplicates.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run db:backup` | Full Mongo dump (`mongodump` → `backups/`) |
| `npm run sync:year` | Backfill from Jan 1 of current year |
| `npm run sync -- --lookback=3` | Short test sync |
| `npm run sync -- --since=2026-01-01` | Custom since date |
| `npm run verify` | Integrity checks |
