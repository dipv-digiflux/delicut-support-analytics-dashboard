# Environment variables — what each one is for

Copy `.env.example` → `.env.local` and fill the Freshchat values.  
**Never commit real tokens.** The app and sync scripts read `.env.local` first, then `.env`.

---

## Freshchat (required for sync)

| Variable | What it’s for |
|----------|----------------|
| `FRESHCHAT_API_BASE` | Your account API root, e.g. `https://mercasto.freshchat.com/v2`. Comes from Freshchat Admin → API settings (chat URL + `/v2`). |
| `FRESHCHAT_API_TOKEN` | Bearer token from Admin → API Tokens. Used only to call Freshchat. |

Without these two, the **UI can still open** (empty data), but `npm run sync` will fail.

---

## MongoDB (local storage)

| Variable | What it’s for |
|----------|----------------|
| `MONGODB_URI` | Connection string. Local default: `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | Database name (default `freshchat_analytics`) |
| `MONGODB_MAX_POOL_SIZE` | How many DB connections the app may open |
| `MONGODB_TIMEOUT_MS` | How long to wait when Mongo is down before erroring |

We **store Freshchat data as received** (plus light structural shaping for queries). We do **not** invent CSAT scores, labels, or rewrite message text.

---

## Sync window / what to pull

| Variable | What it’s for |
|----------|----------------|
| `SYNC_LOOKBACK_DAYS` | On first sync (no cursor yet), how many days back to plan. For “this year”, prefer `--since=2026-01-01` instead of a huge lookback alone. |
| `SYNC_EVENTS` | Comma-separated Extract report names to pull. Default includes transcripts, CSAT, labels, creates, resolves, SLA times. |
| `SYNC_TRANSCRIPT_OVERLAP_HOURS` | Re-fetch this much of recent transcripts so late messages aren’t missed |
| `SYNC_CSAT_OVERLAP_DAYS` | Re-fetch recent CSAT window (ratings often arrive days later) |
| `SYNC_LABEL_OVERLAP_DAYS` | Same for resolution labels |

### Year / “all possible” sync

Extract limits: **~1 job/min**, **~120 jobs/day per event**, transcripts often **1 day per job**.

```bash
# Start year-to-date backfill (resumes next day if quota hits)
npm run sync -- --mode=backfill --since=2026-01-01

# Or use helper
npm run sync:year
```

Re-run daily until the ledger shows all windows `merged`.

---

## Extract API limits (do not raise casually)

| Variable | What it’s for |
|----------|----------------|
| `EXTRACT_MIN_POST_INTERVAL_MS` | Wait between Extract POSTs (default 60000 = 1/min) |
| `EXTRACT_MAX_JOBS_PER_DAY` | Cap per event type (default 120) |
| `EXTRACT_POLL_INTERVAL_MS` | How often to check if a job finished |
| `EXTRACT_JOB_TIMEOUT_MS` | Give up on a stuck job (default ~75 min) |
| `EXTRACT_CACHE_DIR` | Where downloaded CSVs are cached locally |

---

## HTTP retries

| Variable | What it’s for |
|----------|----------------|
| `HTTP_MAX_RETRIES` | Retries on 429/5xx/network |
| `HTTP_BACKOFF_*` / `HTTP_TIMEOUT_*` | Backoff and timeouts |

---

## Writes & users

| Variable | What it’s for |
|----------|----------------|
| `BULK_BATCH_SIZE` | Mongo bulkWrite chunk size |
| `MAX_EMBEDDED_MESSAGES` | Cap messages stored per conversation doc |
| `USER_FETCH_BATCH_SIZE` | Freshchat `/users/fetch` batch (max 100) |
| `USER_ENRICH_MAX_PER_RUN` | Max users enriched per sync |
| `USER_REFRESH_DAYS` | Re-fetch user profile after N days |

User enrichment only **adds** name/email/phone from Freshchat — it does not invent contacts.

---

## Classification (optional — off by default for “as-is” data)

| Variable | What it’s for |
|----------|----------------|
| `CLASSIFY_ENABLED` | `false` = subject comes **only** from Freshchat resolution label (or blank). `true` = optional keyword helper for unlabeled chats. |
| `CLASSIFIER_VERSION` / `CLASSIFY_*` | Only used when `CLASSIFY_ENABLED=true` |
| `CLASSIFY_LLM_ENABLED` | Reserved; leave `false` |

---

## UI / reporting

| Variable | What it’s for |
|----------|----------------|
| `REPORTING_TIMEZONE` | Label on dashboard (storage stays UTC) |
| `SYNC_STALE_AFTER_MINUTES` | When to show “sync may be stale” in UI |

---

## Logging

| Variable | What it’s for |
|----------|----------------|
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `auto` \| `tty` \| `json` |

---

## Minimal `.env.local` to start

```bash
FRESHCHAT_API_BASE=https://YOUR_DOMAIN.freshchat.com/v2
FRESHCHAT_API_TOKEN=paste_token_here
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=freshchat_analytics
CLASSIFY_ENABLED=false
SYNC_EVENTS=Chat-Transcript,CSAT-Score,Conversation-Resolution-Label,Conversation-Created,Conversation-Resolved,First-Response-Time,Resolution-Time
```
