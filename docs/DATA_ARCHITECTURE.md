# Data architecture — how we get data, what we store

This app is a **read-mostly analytics warehouse**: Freshchat is the source of truth, MongoDB is the local store, and the Next.js dashboard only reads Mongo. We do not invent CSAT, labels, or SLA times.

Related: [DATA_FLOW.md](./DATA_FLOW.md) (Freshchat → us + webhooks) · [SYNC.md](./SYNC.md) (ops / resume) · [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) (KPI formulas) · [ENV.md](./ENV.md) (credentials)

---

## 1. Big picture

```
┌─────────────────┐     Extract jobs (CSV)      ┌──────────────────┐
│  Freshchat API  │ ───────────────────────────► │  Sync scripts    │
│  /reports/raw   │     + /v2/users/fetch        │  npm run sync*   │
└─────────────────┘                              └────────┬─────────┘
                                                          │ upsert
                                                          ▼
                                                 ┌──────────────────┐
                                                 │  MongoDB         │
                                                 │  freshchat_      │
                                                 │  analytics       │
                                                 └────────┬─────────┘
                                                          │ aggregate
                                                          ▼
                                                 ┌──────────────────┐
                                                 │  Next.js UI      │
                                                 │  /dashboard      │
                                                 │  /conversations  │
                                                 └──────────────────┘
```

| Layer | Role |
|-------|------|
| **Freshchat** | Source. Extract API for reports; Users API for names/emails. |
| **Sync (`lib/sync`)** | Plans time windows, submits jobs, downloads CSV, merges into Mongo. |
| **MongoDB** | One conversation document per Freshchat id; users + sync ledger. |
| **Dashboard** | Server components + `lib/aggregations.ts` query Mongo only — no live Freshchat calls for KPIs. |

Sync is a **standalone CLI** (`scripts/sync.ts`, `sync:campaign`, etc.), not a Next.js API route. That keeps long Extract jobs out of the web process.

---

## 2. How we get data

### 2.1 Freshchat Extract API

For each planned time window and event type:

1. **POST** `/reports/raw` with `{ start, end, event, format: "csv" }` → job id  
2. **Poll** until status is `COMPLETED` (or fail)  
3. **Download** CSV link(s), optionally cache under `EXTRACT_CACHE_DIR`  
4. **Parse** rows → **merge** into `conversations` / discover `users`  
5. Mark window `merged` in the ledger (skipped on later runs unless `--force`)

Budget (enforced in `sync_state` + code defaults):

- **1 POST / minute** across Extract  
- **~120 jobs / day / event** (Chat-Transcript is the bottleneck for multi-month backfills)

Code path: `lib/freshchat/extract.ts` → `lib/sync/fetcher.ts` → `lib/sync/merge/*`.

### 2.2 Sync pipeline

```
PLAN → FETCH → MERGE → ENRICH → CLASSIFY → FINALIZE
```

| Phase | What happens |
|-------|----------------|
| **PLAN** | Split `[since, until)` into windows (transcript = UTC days ≤24h; other events ≤28d). Write `sync_windows`. |
| **FETCH** | Submit / poll / download each pending window (`processWindow`). |
| **MERGE** | Upsert by Freshchat conversation / message / user ids; content hashes skip no-ops. |
| **ENRICH** | Batch `POST /v2/users/fetch` for discovered customer/agent ids. |
| **CLASSIFY** | Optional (`CLASSIFY_ENABLED=false` by default). Subject = resolution label when classify is off. |
| **FINALIZE** | Update cursors, campaign checkpoint, `sync_runs` counters. |

Entry points:

| Command | Use |
|---------|-----|
| `npm run sync -- --lookback=N` | Incremental / short lookback |
| `npm run sync:campaign -- --id=… --since=… --until=…` | Multi-day backfill with resume + quota pause |
| `npm run sync:status` | Coverage / checkpoint |

Details and Dubai YTD example: [SYNC.md](./SYNC.md).

### 2.3 Windowing rules (why architecture looks like this)

| Event | Max window | Cursor / merge key |
|-------|------------|--------------------|
| `Chat-Transcript` | 24h (UTC day) | Conversation + `message_id` |
| `CSAT-Score` | ≤28d | **Rating submit time** → merge onto any-age conversation (stubs allowed) |
| `Conversation-Resolution-Label` | ≤28d | Same pattern as CSAT |
| `Conversation-Created` / `Resolved` / `First-Response-Time` / `Resolution-Time` | ≤28d | Conversation metrics / lifecycle fields |

“Hot” transcript window (today) is always re-fetched on incremental runs. Older **merged** windows are not re-fetched unless `--force`.

### 2.4 What we do *not* pull yet

Some Extract / Instant Metrics types are listed as future in [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) (e.g. Agent-Activity, Team-Performance-Report, live agent presence). They are **not** in the default `SYNC_EVENTS` set today.

Default sync events (`lib/config.ts`):

`Chat-Transcript`, `CSAT-Score`, `Conversation-Resolution-Label`, `Conversation-Created`, `Conversation-Resolved`, `First-Response-Time`, `Resolution-Time`  
(`Response-Time` / `Message-Sent` exist in types if enabled via `SYNC_EVENTS`).

---

## 3. What data we store

Database name: `MONGODB_DB` (default `freshchat_analytics`).

### 3.1 Collections

| Collection | Key | Purpose |
|------------|-----|---------|
| `conversations` | Freshchat `conversation_id` | Core warehouse: messages, CSAT, labels, SLA metrics |
| `users` | Freshchat user/agent id | Profiles + enrichment status |
| `sync_windows` | `{event}\|{startISO}\|{endISO}` | Resumable Extract job ledger |
| `sync_state` | event cursors + `extract_api` budget | Progress + rate-limit day counters |
| `sync_runs` | ULID run id | One document per sync invocation |
| `sync_campaigns` | campaign id string | Multi-day backfill checkpoint + % complete |

### 3.2 Conversation document (shape)

One Mongo document per Freshchat conversation. Types: `lib/db/types.ts` → `Conversation`.

| Field group | Contents (as-is from Freshchat where possible) |
|-------------|--------------------------------------------------|
| Identity / routing | `_id`, `channel_*`, `assigned_agent_*`, `group_*`, `status`, `conversation_url` |
| Lifecycle | `created_at`, `last_message_at`, `resolved_at`, `resolved`, `reopened` |
| Messages | `messages[]` (`message_id`, actors, text, attachments, **`raw` CSV columns**) |
| CSAT | `csat.rating` (normalized when possible), `rating_raw`, comment, `submitted_at` |
| Resolution | `resolution.label` / `sub_label`, labeled_at, agent |
| Metrics | `metrics.first_response_time_seconds`, `resolution_time_seconds`, `response_time_seconds` |
| Derived | `derived.subject` (+ source/confidence when classify runs) |
| Provenance | `sources.transcript\|csat\|label\|…` each with `hash`, `window_id`, timestamps |
| Stubs | `is_stub` when CSAT/label arrives before transcript |

**Idempotency:** upsert by id; three+ source hashes so one feed does not invalidate another; messages merged by `message_id`; unchanged hash → no write.

### 3.3 Users

Discovered from transcript actors, then enriched via Users API:

- Profile: name, email, phone, `properties`
- `enrichment.status`: `pending` → `ok` / `not_found` / `error`
- Light `stats` (first/last seen, conversation count)

### 3.4 Sync control plane

- **`sync_windows`**: status `planned → submitted → ready → merged` (or `failed` / `skipped`)
- **`sync_campaigns`**: range, order, per-event stats, `checkpoint.next_window_start` for safe resume after quota
- **`sync_runs`**: mode, counters (inserted/updated/unchanged, API waits, etc.)

---

## 4. How the dashboard reads data

```
URL filters (dates, tz, agent, channel, CSAT, …)
        │
        ▼
lib/filter-defaults.ts  →  ConversationFilters
        │
        ▼
lib/aggregations.ts     →  Mongo aggregation on `conversations`
        │
        ├── getKpis()
        ├── charts / breakdowns
        └── conversation list / detail / CSV export
```

- Date **From/To** are calendar days in the selected timezone (Dubai / IST / UTC), converted to UTC for queries.
- KPIs and charts are defined in [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md).
- Sync freshness for the header badge comes from recent `sync_runs` / campaign status (`/api/sync-status`).

No dashboard path should invent metrics that are missing in Mongo — missing CSAT or FRT stays empty/null.

---

## 5. Entity relationships (logical)

```
sync_campaigns ──plans──► sync_windows ──produces CSV──► merge
                              │
                              ▼
                         conversations ◄── users (by user_ids / agent_ids)
                              │
                              └── sources.* tie back to sync_windows._id

sync_state  = cursors per Extract event + daily POST budget
sync_runs   = audit of each npm run sync*
```

Indexes (created by `npm run db:init` / sync start): see `lib/db/indexes.ts` — `created_at`, agent/channel filters, embedded `messages.message_id`, window status, campaigns by status.

---

## 6. Design principles (short)

1. **Freshchat as-is** — keep `rating_raw`, label text, and message `raw` columns.  
2. **Resumable sync** — ledger + campaign checkpoint; never require a full wipe for normal backfill.  
3. **Respect Extract quotas** — plan day-sized transcript jobs; pause and resume tomorrow.  
4. **Idempotent merges** — safe to re-run the same command.  
5. **Read path stays local** — UI never depends on Extract latency for charts.

---

## 7. Quick map: “I need X” → where it lives

| Need | Look at |
|------|---------|
| Pull / resume data | [SYNC.md](./SYNC.md), `npm run sync:status` |
| Field meanings / KPI math | [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) |
| Env / timezone | [ENV.md](./ENV.md) |
| TypeScript shapes | `lib/db/types.ts` |
| Merge rules | `lib/sync/merge/*.ts` |
| Extract HTTP | `lib/freshchat/extract.ts` |
|
