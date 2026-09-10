# Data flow — Freshchat → this dashboard

How Freshchat can send us data, **what we actually use**, how webhooks fit, and **what we will not get** with the current setup (and with webhooks alone).

Related: [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) · [SYNC.md](./SYNC.md) · [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) · [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md)

---

## Verdict (read this first)

| Question | Answer |
|----------|--------|
| How does data reach us **today**? | We **pull** Extract CSV reports + Users API. Nothing is pushed to us. |
| Does Freshchat **offer** live push? | **Yes** — Chat **webhooks** (4 event types). |
| Are we using webhooks? | **No.** No webhook URL / receiver in this app. |
| Is the dashboard live? | **No.** UI reads Mongo only. Freshness = last `npm run sync*`. |

---

## 1. All ways Freshchat can give us data

Freshchat does **not** “stream a warehouse” into our DB by default. They expose these **pipes**. We choose which to wire.

```
                    ┌─────────────────────────────────────┐
                    │           FRESHCHAT                 │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐      ┌────────────────┐      ┌────────────────┐
   │ A. Extract    │      │ B. Webhooks    │      │ C. REST APIs   │
   │    (batch)    │      │    (push)      │      │  (on demand)   │
   │ WE USE THIS   │      │ NOT USED       │      │ Users: YES     │
   │               │      │                │      │ Chat REST: NO  │
   │ Us → FC POST  │      │ FC → our URL   │      │ for KPIs       │
   │ job → CSV     │      │ when event     │      │                │
   └───────┬───────┘      └───────┬────────┘      └───────┬────────┘
           │                      │                       │
           │                      │ (not built)           │ enrich only
           ▼                      ▼                       ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  OUR APP: sync CLI → Mongo → Next.js dashboard                 │
   └──────────────────────────────────────────────────────────────┘
```

| Pipe | Direction | When data moves | Good for | Used by us? |
|------|-----------|-----------------|----------|-------------|
| **A. Extract API** | We pull | When we run sync | History, CSAT, labels, SLA seconds, transcripts | **Yes — primary** |
| **B. Chat webhooks** | They push | Instantly on event | Live messages / assign / resolve / reopen | **No** |
| **C. REST APIs** | We pull | When we call | Users, single conversation, bots/CRM | **Users only** (enrich) |

There is **no** fourth pipe like “Freshchat hosts our Mongo” or “they email us daily dumps for this app.” If we don’t pull (A/C) or register a webhook (B), **we get nothing**.

---

## 2. What each pipe can deliver (and what it cannot)

### A. Extract API — batch reports (pull)

**How:** `POST /v2/reports/raw` with `{ start, end, event, format: "csv" }` → poll job → download CSV.

**Official report types (examples):** Conversation-Created, Conversation-Resolved, Chat-Transcript / message-related extracts, CSAT-Score, Conversation-Resolution-Label, First-Response-Time, Resolution-Time, Response-Time, Message-Sent, Agent-Activity, Team performance, etc.  
Docs: [Extract API](https://crmsupport.freshworks.com/support/solutions/articles/50000004465-extract-api)

**Limits that shape our design:**

- ~**1 POST / minute**
- ~**120 jobs / day / event**
- Transcript windows often **~24h**
- CSAT / labels / metrics typically **≤ ~1 month** per job
- Not real-time (job may take minutes)

### B. Webhooks — live push

**How:** Admin configures a URL under **Settings / Configure → Webhooks**. Freshchat POSTs JSON when something happens. Header `X-Freshchat-Signature` + public key for verify.

Docs:

- [Configure APIs & webhooks](https://crmsupport.freshworks.com/support/solutions/articles/50000002712-how-to-configure-conversation-apis-and-webhooks-for-chat-)
- [Payload & auth](https://crmsupport.freshworks.com/support/solutions/articles/50000004461-freshchat-webhooks-payload-structure-and-authentication)

| Event (`action`) | What Freshchat sends |
|------------------|----------------------|
| `message_create` | New message (user / agent / system), conversation id, parts |
| `conversation_assignment` | Assign / reassign to agent or group |
| `conversation_resolution` | Conversation marked resolved |
| `conversation_reopen` | Conversation reopened |

**Webhook does *not* send:** CSAT surveys, resolution labels/sub-labels, FRT/resolution-time **seconds**, Agent-Activity reports, full historical backfill, Instant Metrics rollups.

### C. REST (Conversations / Users / CSAT endpoints)

**How:** Bearer token, normal HTTP to `/v2/...`.

| API area | We use? | Notes |
|----------|---------|--------|
| `POST /v2/users/fetch` | **Yes** | After sync discovers ids — names, email, phone |
| Conversations / messages REST | **No for KPIs** | Fine for bots/inbox; Extract is our warehouse path |
| Create CSAT via REST | **No** | Ratings land via Extract `CSAT-Score` |

---

## 3. What *we* use today (exact)

### In use

| Source | Events / calls | Lands in |
|--------|----------------|----------|
| Extract | `Chat-Transcript` | `conversations.messages`, channel/actors |
| Extract | `CSAT-Score` | `conversations.csat` |
| Extract | `Conversation-Resolution-Label` | `conversations.resolution` |
| Extract | `Conversation-Created` | create time, dims, reopen flags |
| Extract | `Conversation-Resolved` | resolve time / status |
| Extract | `First-Response-Time` | `metrics.first_response_time_seconds` |
| Extract | `Resolution-Time` | `metrics.resolution_time_seconds` |
| Users API | `/v2/users/fetch` | `users` collection |

Default list is `SYNC_EVENTS` in `lib/config.ts` (override via env).

### Flow we run

```
Trigger: npm run sync | sync:campaign | sync:year
        → PLAN windows
        → FETCH Extract (POST → poll → CSV)
        → MERGE into Mongo (upsert by Freshchat ids)
        → ENRICH users
        → FINALIZE cursors / campaign checkpoint
        → Dashboard reads Mongo only
```

Code: `lib/freshchat/extract.ts` → `lib/sync/*` → Mongo → UI (`lib/aggregations.ts`).

### Not in use (even though Freshchat has them)

| Capability | Status |
|------------|--------|
| Chat webhooks (all 4 events) | Not registered / no ingest route |
| Extract `Response-Time`, `Message-Sent` | Typed in code; **off** unless added to `SYNC_EVENTS` |
| Extract Agent-Activity / Team-Performance / etc. | Documented as future in KPIs; **not synced** |
| Instant Metrics / live agent presence | **Not synced** |
| Conversations REST as primary feed | **Not used** |

---

## 4. Current end-to-end path (diagram)

```
┌──────────────────┐     WE PULL (Bearer)      ┌──────────────────┐
│ Freshchat        │  Extract CSV + Users API  │ Sync CLI         │
│ (source of truth)│ ─────────────────────────►│ npm run sync*    │
└──────────────────┘                           └────────┬─────────┘
                                                        │ upsert
                                                        ▼
                                               ┌──────────────────┐
                                               │ MongoDB          │
                                               │ freshchat_       │
                                               │ analytics        │
                                               └────────┬─────────┘
                                                        │ query
                                                        ▼
                                               ┌──────────────────┐
                                               │ Next.js UI       │
                                               │ /dashboard etc.  │
                                               └──────────────────┘

     ─── Webhooks (Freshchat → us) ───  NOT CONNECTED
```

---

## 5. What we will **not** get (gaps / misses)

This is the important “based on what is missing” section.

### 5.1 With **current** setup (Extract pull only, no webhooks)

| You will **not** get | Why |
|----------------------|-----|
| **True live / second-level updates** | We only update when sync runs; UI never listens to Freshchat. |
| **Automatic push when a chat happens** | Webhooks not wired — Freshchat is not POSTing to us. |
| Data for windows we **never synced** | No pull = empty Mongo for that range. |
| **Same-day completeness without re-sync** | Today’s transcript is only as fresh as the last lookback run. |
| **Continuous feed during Extract quota pause** | ~120 Chat-Transcript jobs/day; campaign can be `paused_quota` until tomorrow. |
| Extract types we **didn’t enable** | e.g. Agent-Activity, Team-Performance, live presence — not in default `SYNC_EVENTS`. |
| Guaranteed **Instant Metrics** parity with Freshchat’s live admin boards | Different product surface; we warehouse Extract CSVs. |
| Anything if **token / Extract access** is wrong | Fail closed — sync errors, dashboard shows old or empty data. |

**You *do* get (when sync has run):** historical transcripts, CSAT, resolution labels, created/resolved lifecycle, FRT & resolution-time seconds — i.e. the core analytics warehouse.

### 5.2 If we used **webhooks only** (no Extract) — what we would miss

| Missing for our KPIs | Notes |
|----------------------|--------|
| **CSAT** rating + comment | No CSAT webhook event |
| **Resolution labels** / sub-labels | Not in the four webhook actions |
| **FRT / resolution time in seconds** | Webhooks say “resolved”; they don’t ship SLA report fields |
| **Multi-month history** | Webhooks only fire from the moment you turn them on |
| **Catch-up after downtime** | Missed webhook deliveries ≠ full Extract replay (need Extract or REST repair) |
| Agent activity / team performance reports | Extract (or other APIs), not these webhooks |

So: **webhooks alone cannot power this dashboard’s CSAT / label / SLA KPIs.** Extract (or equivalent report pull) stays required.

### 5.3 Side-by-side: need → available on which pipe → our status

| Business need | Extract | Webhook | REST | What we do today |
|---------------|:-------:|:-------:|:----:|------------------|
| Chat messages / transcript | Yes | `message_create` (live only) | Yes | **Extract** |
| Historical backfill (months) | Yes | No | Painful | **Extract campaign** |
| CSAT | Yes | **No** | Create/limited | **Extract** |
| Resolution label | Yes | **No** | — | **Extract** |
| FRT / resolution seconds | Yes | **No** | — | **Extract** |
| Created / resolved timestamps | Yes | resolve/reopen (partial) | Yes | **Extract** |
| Assign agent/group (live) | Some reports | Yes | Yes | Extract created/resolved dims; **no live assign feed** |
| Customer name / email | — | Partial in payload | **Yes** | **Users fetch** |
| Live agent online / presence | Instant Metrics / activity | No | — | **Not implemented** |
| Real-time dashboard refresh | No | Would help messages/status | Poll | **Not implemented** |

---

## 6. Freshness (what “up to date” means for us)

| Mode | How | Typical lag |
|------|-----|-------------|
| Incremental sync | `npm run sync -- --lookback=1` (or 3) | Until someone/cron runs it |
| Campaign backfill | `npm run sync:campaign …` | Hours–days (quota) |
| Webhook live | *not built* | Would be seconds–minutes for those 4 events only |
| Cron (optional later) | Schedule Extract lookback | “Near daily / hourly,” still not webhook-live |

Header badge / `/api/sync-status` reflects **last sync**, not Freshchat wall-clock.

---

## 7. If we add webhooks later (optional)

Still **not** a replacement for Extract:

1. Public `POST /api/webhooks/freshchat` + signature verify.  
2. Upsert messages / resolve / assign / reopen into Mongo.  
3. **Keep Extract** for CSAT, labels, SLA metrics, and history repair.  
4. Confirm Webhooks UI exists on **this** tenant (Suite vs standalone).

Until then: **only Extract + Users enrich = Freshchat → us.**

---

## 8. Quick links

| Need | Doc |
|------|-----|
| Admin token / Extract check | [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md) |
| Collections / merge | [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) |
| Resume / quota | [SYNC.md](./SYNC.md) |
| KPI formulas | [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) |
| Env | [ENV.md](./ENV.md) |
