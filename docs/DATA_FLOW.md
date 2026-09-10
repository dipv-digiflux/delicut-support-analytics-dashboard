# Data flow — Freshchat → this dashboard

Plain-language map of **how chat data reaches us today**, and **what Freshchat can push live** (webhooks) vs what we actually use.

Related: [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) (storage / merge) · [SYNC.md](./SYNC.md) (ops) · [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) · [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md)

---

## Verdict (read this first)

| Question | Answer |
|----------|--------|
| Does Freshchat **push** live data to us today? | **No.** We do not receive webhooks or any push feed. |
| Does Freshchat **offer** something like that? | **Yes** — Chat **webhooks** exist (messages, assign, resolve, reopen). |
| How do we get data **today**? | We **pull** reports via the **Extract API** (`POST /v2/reports/raw` → CSV → Mongo). |
| Is the dashboard “live”? | **No.** UI reads Mongo only. Freshness = last successful `npm run sync*`. |

So: Freshchat *can* provision near-real-time events over HTTPS webhooks, but **this project does not use that path**. Analytics (CSAT, labels, FRT, resolution time, full transcripts for history) come from **Extract**, which is batch/pull and rate-limited.

---

## 1. Current flow (what we run)

```
┌──────────────────────────────────────────────────────────────────┐
│  Freshchat (source of truth)                                      │
│  • Conversations, messages, CSAT, labels, SLA metrics             │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              │  WE PULL (not push)
                              │  Bearer token → Extract + Users API
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sync CLI (standalone — not the Next.js web process)              │
│  npm run sync / sync:campaign / sync:year                         │
│                                                                   │
│  PLAN windows → FETCH jobs → MERGE CSV → ENRICH users → FINALIZE  │
└─────────────────────────────┬────────────────────────────────────┘
                              │  upsert
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  MongoDB (freshchat_analytics)                                    │
│  conversations · users · sync_windows · sync_state · sync_runs    │
└─────────────────────────────┬────────────────────────────────────┘
                              │  aggregate / query
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js dashboard                                                │
│  /dashboard · /conversations · /api/sync-status                   │
│  No live Freshchat calls for KPIs                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Step-by-step

1. **Trigger** — Someone (or cron later) runs `npm run sync -- --lookback=N` or a campaign.
2. **Plan** — Code splits the time range into Extract windows (transcript ≈ 1 UTC day; CSAT/labels/metrics ≤ ~28 days).
3. **Fetch** — For each window: `POST /v2/reports/raw` → poll job → download CSV (optional disk cache).
4. **Merge** — Upsert into `conversations` / discover `users` (idempotent by Freshchat ids + content hashes).
5. **Enrich** — Batch `POST /v2/users/fetch` for names/emails when needed.
6. **Serve** — Dashboard queries Mongo (`lib/aggregations.ts`). Header “freshness” comes from `sync_runs` / campaign status.

Quota (why it is not continuous live): **~1 Extract POST / minute**, **~120 jobs / day / event**. Chat-Transcript is the bottleneck for long backfills.

Code: `lib/freshchat/extract.ts` → `lib/sync/*` → `lib/db/*` → UI.

---

## 2. What Freshchat provides (product capability)

Freshchat exposes **three** relevant integration styles. Only **A** is wired in this repo.

### A. Extract API (batch pull) — **what we use**

- **Direction:** Us → Freshchat (we request reports).
- **Shape:** Async job → CSV of historical events.
- **Good for:** Analytics warehouse, backfill, CSAT, resolution labels, FRT / resolution time, transcripts.
- **Not good for:** Second-by-second UI updates.
- Docs: [Extract API](https://crmsupport.freshworks.com/support/solutions/articles/50000004465-extract-api)

Events we sync by default (see `SYNC_EVENTS` / `lib/config.ts`):

`Chat-Transcript`, `CSAT-Score`, `Conversation-Resolution-Label`, `Conversation-Created`, `Conversation-Resolved`, `First-Response-Time`, `Resolution-Time`

### B. Chat webhooks (push) — **Freshchat offers; we do not consume**

- **Direction:** Freshchat → **your HTTPS URL** when something happens.
- **Configure:** Freshchat Admin → **Settings / Configure → Webhooks** (exact menu varies by Suite vs standalone).
- **Auth:** Header `X-Freshchat-Signature`; verify with the public key from webhook settings.
- Docs: [Configure Conversation APIs and Webhooks](https://crmsupport.freshworks.com/support/solutions/articles/50000002712-how-to-configure-conversation-apis-and-webhooks-for-chat-) · [Webhook payload & auth](https://crmsupport.freshworks.com/support/solutions/articles/50000004461-freshchat-webhooks-payload-structure-and-authentication)

| Webhook `action` | Meaning |
|------------------|---------|
| `message_create` | New message (user / agent / system) |
| `conversation_assignment` | Assigned / reassigned to agent or group |
| `conversation_resolution` | Marked resolved |
| `conversation_reopen` | Reopened |

**Gaps vs our dashboard needs:**

| Data we need for KPIs | On webhook? | How we get it today |
|-----------------------|-------------|---------------------|
| Full historical transcript / multi-month backfill | No (events only as they happen) | Extract `Chat-Transcript` |
| CSAT rating + comment | **No dedicated CSAT webhook** | Extract `CSAT-Score` |
| Resolution label / subcategory | **Not in the four events above** | Extract `Conversation-Resolution-Label` |
| First-response / resolution **seconds** | **No** | Extract `First-Response-Time` / `Resolution-Time` |
| Live message / resolve / assign | Yes | Unused |

Webhooks are useful for **bots, CRM sync, alerts, near-real-time inbox mirrors**. They are **not** a full replacement for Extract for this analytics product.

### C. Conversations / Users REST API — **partial use**

- **Users:** we call `/v2/users/fetch` during **ENRICH**.
- **Conversations REST:** available for read/write chat workflows; **not** the primary path for dashboard KPIs (Extract CSVs are).
- Docs: [developers.freshchat.com/api](https://developers.freshchat.com/api/)

---

## 3. “Are they provisioning us live data?”

| Check | Status |
|-------|--------|
| Webhook URL registered in Freshchat pointing at this app | **No** (no webhook receiver in this codebase) |
| Freshchat POSTing `message_create` etc. to us | **No** |
| Scheduled / manual Extract pull into Mongo | **Yes** |
| Dashboard hits Freshchat on every page load | **No** |

If someone enables webhooks in Freshchat admin **without** building an ingest endpoint here, those events go nowhere useful for this dashboard.

---

## 4. Freshness model (practical)

| Mode | Command | Typical lag |
|------|---------|-------------|
| Incremental | `npm run sync -- --lookback=1` (or 3) | Minutes–hours after you run it; “today” transcript re-fetched |
| Backfill / campaign | `npm run sync:campaign …` | Days if quota pauses (`paused_quota` → resume tomorrow) |
| Live push | *not implemented* | Would be seconds–minutes if webhooks were added |

Optional later: cron `npm run sync -- --lookback=1` every N hours for “almost daily” freshness without webhooks.

---

## 5. If we ever add webhooks (future — not built)

Would need roughly:

1. Public HTTPS endpoint (e.g. `POST /api/webhooks/freshchat`) + signature verify.
2. Map `message_create` / resolve / assign / reopen → Mongo upserts.
3. Keep **Extract** for CSAT, labels, SLA metrics, and historical catch-up (webhooks miss history and those report types).
4. Confirm plan/UI location for Webhooks on **this** tenant (Suite vs standalone).

Until then, **Extract pull = the only Freshchat → us data path.**

---

## 6. Quick links

| Need | Where |
|------|--------|
| Admin token / Extract verify | [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md) |
| Collections & merge rules | [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) |
| Resume after quota | [SYNC.md](./SYNC.md) |
| What each KPI uses | [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) |
