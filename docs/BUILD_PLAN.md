# Freshchat Analytics Dashboard — Final Build Plan

**Status:** Ready to implement after you complete the Freshchat Admin checklist and provide API credentials.  
**Repo:** `/Users/digiflux/Playground/freshchat-dashboard` (empty / greenfield)  
**DB for now:** local MongoDB (`mongodb://127.0.0.1:27017`, db `freshchat_analytics`)

---

## Verdict

Your draft plan is directionally right (Extract → Mongo upsert → classify → Next.js dashboard). Several Freshchat API realities force design changes before we build:

1. **`Chat-Transcript` windows are max 24 hours**, not 1 month. A 30-day backfill = ~30 transcript jobs.
2. **Extract rate limits:** 1 POST/minute + 120 jobs/day/event. Sync must be resumable via a window ledger, not a single “fetch everything” loop.
3. **Late CSAT is keyed by rating submit time**, not conversation date — overlapping old conversation windows does **not** catch late ratings. CSAT cursor must move forward independently and merge onto conversations of any age (including stubs).
4. **One `raw_hash` per conversation is wrong** — use **three source hashes** (`transcript`, `csat`, `label`) so feeds don’t invalidate each other.
5. **Users:** prefer `POST /v2/users/fetch` (100 IDs) over per-user GET; no unfiltered bulk list.
6. **Charting:** keep your choice — Chart.js + `react-chartjs-2` (not Recharts).

---

## What you do first (before we code against live data)

1. Walk through [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md).
2. Start local MongoDB.
3. Put credentials in `.env.local` (never commit).
4. We build Phase 1 → you run sync → we verify “run twice = all unchanged”.
5. Then Phase 2–5 (classify → APIs → dashboard → table/detail).

---

## 1. Goal (locked)

Build a system that:

1. Pulls transcripts, CSAT, and resolution labels from Freshchat Extract API.
2. Stores them in **local MongoDB** with upserts — **no duplicates**; changed data **updates** existing docs.
3. Classifies subject (resolution label first → keyword classifier; LLM optional later).
4. Serves a Next.js dashboard: KPIs, charts, conversations table, chat detail.
5. Logs sync progress live to the terminal.

Each phase must work end-to-end before the next.

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js App Router + TypeScript |
| DB | Local MongoDB via official `mongodb` driver (no Mongoose) |
| Validation | `zod` at parse/config boundaries |
| Sync | Standalone `scripts/sync.ts` (tsx) — **not** a Next API route |
| Charts | Chart.js + `react-chartjs-2` |
| UI | Tailwind + shadcn/ui, compact ops analytics look |
| Classify (P2) | Keyword/rules engine; LLM gated later |

---

## 3. Critical corrections vs your draft

| Draft assumption | API reality | What we do |
|------------------|-------------|------------|
| Transcript ≤1 month | **≤24h** | Day-aligned UTC windows; hot window = today |
| Single sync_runs enough | Jobs long + quota | Add **`sync_windows` ledger** + **`sync_state` cursors/budget** |
| Overlap old convos for late CSAT | CSAT filtered by **submit time** | Independent CSAT cursor; merge by `conversation_id`; allow **stub** docs |
| One `raw_hash` | 3 independent feeds | `sources.transcript.hash`, `.csat.hash`, `.label.hash` |
| Replace `messages` array | Convos can straddle midnight | Merge by **`message_id`** |
| Per-user GET only | `POST /v2/users/fetch` (100) | Batch enrichment queue |
| `$currentDate` every touch | Breaks idempotency test | Bump `updated_at` **only on content change** |

---

## 4. MongoDB data model (refined)

Database: `freshchat_analytics`

### 4.1 `conversations` (one doc per Freshchat conversation_id)

- `_id` = Freshchat `conversation_id`
- Status / agent / group / channel fields
- `messages[]` embedded, keyed by `message_id`, sorted by `created_at`
- `csat: { rating, rating_raw, comment, submitted_at, survey_id } | null`
- `resolution: { label, sub_label, labeled_at, labeled_by_agent_id } | null`
- `derived: { subject, subject_source, confidence, matched_keywords, classifier_version, classified_at } | null`
- `sources: { transcript?, csat?, label? }` each with `{ hash, window_id, fetched_at, updated_at }`
- `is_stub` + `stub_reason` when CSAT/label arrives before transcript
- Indexes: `created_at`, `derived.subject`, `csat.rating`, `assigned_agent_id`, `status+created_at`, stubs partial

### 4.2 `users`

- `_id` = Freshchat user/agent id; `role: user|agent`
- Profile fields + `enrichment: { status, hash, fetched_at, attempts, last_error }`
- Discovered from transcripts; enriched via `/users/fetch`

### 4.3 `sync_windows` (job ledger — resumable)

- Deterministic `_id`: `${event}|${startISO}|${endISO}`
- Status: `planned → submitted → ready → merged` (or `failed` / `skipped`)
- Stores job id, download links, row/write counters, CSV checksum
- Hot windows always re-fetched; cold `merged` skipped unless `--force`

### 4.4 `sync_state`

- Per-event cursor: `last_successful_end` advanced by **contiguous watermark** (hole pins cursor)
- Extract budget: `last_post_at`, `posts_today` per event (survives process restart)

### 4.5 `sync_runs`

- Run observability: mode, counters, errors, status `completed|partial|failed|aborted`

---

## 5. Sync algorithm (Phase 1 heart)

```
PLAN → FETCH (submitter + poller) → MERGE → ENRICH → CLASSIFY → FINALIZE
```

### Windowing

| Event | Max span | Alignment | Overlap |
|-------|----------|-----------|---------|
| `Chat-Transcript` | **24h** | UTC calendar days | 24h (hot day) |
| `CSAT-Score` | ≤1 month | UTC months / incremental slice | 2 days |
| `Conversation-Resolution-Label` | ≤1 month | same | 2 days |

Lookback: `SYNC_LOOKBACK_DAYS` (default 30) when no cursor. Quota: stop submitting at 120/day; run ends `partial`, resume next day.

### Merge rules

- **Transcript:** group CSV by `conversation_id`; merge messages by `message_id`; hash merged content; skip write if hash unchanged.
- **CSAT / Label:** upsert by `conversation_id`; if missing → stub; if later transcript arrives → clear stub, keep csat/resolution.
- **Never** stamp `updated_at` on unchanged docs.

### Failure policy

- `401/403` → abort run fatal
- `429` → Retry-After / exponential backoff
- `5xx` / network → retry then mark window failed; don’t kill whole sync
- S3 link expired → re-poll job once for fresh links
- Ctrl-C → `aborted`; next run resumes ledger

### Terminal logging

Structured progress: window planning, job polling, download rows, merge counts, enrich/classify, final summary. TTY progress bars optional; NDJSON when piped.

### Phase 1 acceptance gate

```bash
npx tsx scripts/sync.ts --lookback=3   # first run: inserts > 0
npx tsx scripts/sync.ts --lookback=3   # second: inserted=0 updated=0 unchanged=all
npx tsx scripts/verify.ts --snapshot   # two snapshots must diff empty
```

---

## 6. Subject classification (Phase 2)

1. If resolution label present and not noise → `subject_source: resolution_label`
2. Else keyword score on first N **user** messages → `keyword`
3. Else `unclassified` / `none`
4. Re-run only when transcript/label hash changed or `classifier_version` bumped
5. LLM tier optional later (`CLASSIFY_LLM_ENABLED`)

---

## 7. UI plan (Phases 4–5)

### Routes

- `/` → redirect `/dashboard`
- `/dashboard` — filters + KPI cards + 4 charts + sync badge
- `/conversations` — paginated sortable table (filters in URL)
- `/conversations/[id]` — chat bubbles + metadata sidebar

### Shared filters (URL query)

`from`, `to`, `subject`, `agent`, `resolved`, `csat`, `q` (table), `page`, `limit`, `sort`, `order`

### KPI formulas (accuracy)

| KPI | Formula |
|-----|---------|
| Total | `COUNT(*)` |
| Unique users | `COUNT DISTINCT user_id` (exclude null) |
| Resolution rate | `resolved / total` |
| Avg CSAT | `AVG(csat)` where rated; show **rated n**; null if n=0 |
| % satisfied | `csat >= 4 / rated` |

Charts: daily CSAT trend, CSAT distribution doughnut, conversations by subject, avg CSAT by agent (min sample badge).

### Visual direction

Ops analytics: slate/blue, compact, shadcn, sticky filter bar, left sidebar. Not a marketing landing page. CSAT colors: 1–2 red, 3 amber, 4–5 green.

### Empty / partial states

- Never synced → setup CTA (“add credentials + run sync”)
- No filter matches → zero state + clear filters
- Partial sync → amber banner
- Unrated CSAT → `—` with “Based on 0 of N”
- Unclassified / Unassigned buckets explicit

---

## 8. API contracts (Phase 3)

Thin routes → shared `lib` match builders + aggregations:

- `GET /api/kpis` → KPIs + chart series + `meta.lastSyncedAt`
- `GET /api/conversations` → paginated items
- `GET /api/conversations/[id]` → full transcript + user + csat + subject
- `GET /api/sync-status` → latest run + watermark + state

Single `buildConversationMatch(filters)` used by dashboard and table so numbers never diverge.

---

## 9. Build phases

| Phase | Deliverable | Verify |
|-------|-------------|--------|
| **0 — Docs + scaffold** | README, admin checklist, `.env.example`, Next+TS scaffold, Docker Compose Mongo optional | Docs readable; `mongosh` connects |
| **1 — Sync + Mongo** | `init-db`, `sync.ts`, ledger, hashes, enrich, live logs | Double-run unchanged; verify checks |
| **2 — Classify** | Label-first + keyword taxonomy | Spot-check subjects; unclassified rate logged |
| **3 — APIs** | Four routes + filter helpers | curl/Postman against real Mongo |
| **4 — Dashboard UI** | `/dashboard` KPIs + charts + filters + sync badge | Numbers match Mongo aggregations |
| **5 — Table + detail** | `/conversations`, `/conversations/[id]` | Pagination, filters, chat UI |
| **6 — Scheduling (later)** | cron / GitHub Action / Vercel Cron | Nightly incremental without dupes |

**Do not start Phase 4 until Phase 1–3 are solid.**

---

## 10. Repo docs

| Path | Purpose | Status |
|------|---------|--------|
| `README.md` | Quickstart pointer | ✅ created |
| `docs/BUILD_PLAN.md` | This plan (living) | ✅ created |
| `docs/FRESHCHAT_ADMIN_CHECKLIST.md` | Freshchat-side action list | ✅ created |
| `docs/SYNC.md` | Windowing, ledger, retries, resume | pending (with Phase 1) |
| `docs/DATA_MODEL.md` | Collections, hashes, indexes, KPI semantics | pending (with Phase 1) |
| `.env.example` | All vars, no secrets | pending (with scaffold) |

---

## 11. Environment (local)

```bash
FRESHCHAT_API_BASE=https://<domain>.freshchat.com/v2
FRESHCHAT_API_TOKEN=
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=freshchat_analytics
SYNC_LOOKBACK_DAYS=30
REPORTING_TIMEZONE=Asia/Kolkata
CLASSIFY_LLM_ENABLED=false
# Extract limits — do not raise without plan confirmation
EXTRACT_MIN_POST_INTERVAL_MS=60000
EXTRACT_MAX_JOBS_PER_DAY=120
```

---

## 12. File tree (target)

```
app/(analytics)/dashboard/...
app/(analytics)/conversations/...
app/api/{kpis,conversations,sync-status}/...
lib/{config,db,freshchat,sync,parse,hash,classify,filters,aggregations}/
scripts/{sync,init-db,verify,reclassify}.ts
docs/{BUILD_PLAN,FRESHCHAT_ADMIN_CHECKLIST,SYNC,DATA_MODEL}.md
docker-compose.yml   # optional local mongo
.env.example
```

---

## 13. Freshchat Admin Checklist

Full actionable checklist (with verify steps and fixture table):

→ **[FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md)**

Complete that first, then provide domain + token for sync.

---

## 14. Use-case coverage (must remain true)

| Scenario | Expected |
|----------|----------|
| First sync empty DB | Inserts; cursors set |
| Immediate re-run | 0 created/updated; all unchanged |
| New chat today | Hot window only updates |
| Midnight-straddling chat | Messages merged, no truncation/dupes |
| CSAT 10 days late | Merges onto old convo; transcript hash untouched |
| CSAT before transcript | Stub then completed later |
| Empty resolution label | Keyword / unclassified |
| 401 | Abort; no cursor advance |
| 429 | Backoff; continue |
| Quota 120 hit | `partial`; resume next day |
| Ctrl-C mid-run | Resume from ledger |
| Two syncs at once | Budget doc serializes POSTs |

---

## 15. Implementation order (when you say “build”)

1. Scaffold Next.js + TS + Tailwind + `.env.example` + docs (including checklist).
2. Docker Compose or document Homebrew Mongo; `scripts/init-db.ts`.
3. Freshchat client + budget + extract submit/poll/download.
4. Sync planner/ledger/merge/enrich + terminal reporter.
5. `verify.ts` + double-run gate.
6. Classifier.
7. API routes + aggregations.
8. Dashboard UI, then conversations table + detail.
9. Cron only after manual sync is boringly reliable.

---

## 16. Out of scope (for now)

- Vercel serverless sync (timeouts) — use standalone script / later cron
- LLM classification (optional Phase 2.5)
- Real-time Metrics API as primary source (can add later for live KPIs; warehouse remains Extract)
- Atlas (local Mongo first; swap URI later)
- Auth on the dashboard (add when exposing beyond localhost)

---

## Open points to confirm with your account (during checklist)

1. Is `Chat-Transcript` max range **24h** on your tenant? (validate with one POST)
2. Does Extract work on your plan even if Chat REST is restricted?
3. Exact host string for Suite vs standalone
4. Typical resolution-label fill rate (drives classifier effort)
