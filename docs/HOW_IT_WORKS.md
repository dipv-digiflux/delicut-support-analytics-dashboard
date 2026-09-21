# How this dashboard works

Start here if you need to explain **what this product is, what each screen means, and what we are not pretending to measure**.

Related: [DATA_FLOW.md](./DATA_FLOW.md) (Freshchat pipes) · [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) (Mongo / sync) · [DASHBOARD_KPIS.md](./DASHBOARD_KPIS.md) (formulas) · [ENV.md](./ENV.md)

**In the app:** sidebar **How it works** (`/how-it-works`) is the same map.

---

## What this is

A **read-only support analytics warehouse** for Delicut Freshchat.

1. We **pull** Freshchat Extract CSVs + user enrich into local Mongo (`freshchat_analytics`).
2. The Next.js UI **only reads Mongo**. It never calls Freshchat for KPIs.
3. Freshness = last `npm run sync*` — not live.

We do **not** invent CSAT, agent tags, or SLA seconds. Optional keyword classify writes a local `derived` subject only. It never writes back to Freshchat.

---

## One picture

```
Freshchat Extract + Users API
        │  npm run sync*
        ▼
Mongo  (conversations, users, sync ledger)
        │  aggregations
        ▼
Next.js UI
  /dashboard     ops KPIs, 1–2★ board, FRT tail
  /conversations raw chats + kw badge
  /users         customers + chat history
  /insights/cx   Experience briefing (frozen copy)
  /insights/marketing  Demand briefing (frozen copy)
  /outcomes      chat-risk language (not true churn)
  /sales         Phone-ZIWO chats (not sales CRM)
  /data-flow     what is synced vs not

Optional (empty today → honest empty / unmatched)
  PLATFORM_MONGODB_URI   → order snapshot on chat sidebar
  ANALYTICS_MYSQL_URI    → real renewal / AOV on /outcomes
  ZIWO_INGEST_URI        → connect / talk-time / revenue on /sales
```

---

## Screens

| Screen | Path | What it answers | Honesty rule |
|--------|------|-----------------|--------------|
| **Dashboard** | `/dashboard` | Volume, CSAT, FRT, labels, 1–2★ reasons | Two CSAT denominators. Label coverage = Freshchat tags only. |
| **Conversations** | `/conversations` | Raw rows behind any tile | `kw` = keyword inferred. Filter **Subject source**. |
| **Chat** | `/conversations/[id]` | Transcript + Account / orders | Orders stay unmatched until platform Mongo. |
| **Customers** | `/users` | People + their chats | Same Account snapshot. |
| **Experience** | `/insights/cx` | Five CX briefing checks | Copy frozen. Do not rewrite. |
| **Demand** | `/insights/marketing` | Five CMO briefing checks | Copy frozen. Do not rewrite. |
| **Chat risk** | `/outcomes` | Pause / cancel / refund **talk** vs CSAT / FRT | Not subscription non-renewal. |
| **Phone Sales** | `/sales` | Phone-ZIWO **chats** | Not dialer CRM. Connect / talk / revenue stay `—`. |
| **Data flow** | `/data-flow` | What Extract events are in Mongo | UI is as fresh as last sync. |

Default login: `DASHBOARD_ADMIN_USER` / `DASHBOARD_ADMIN_PASSWORD` (local: admin / admin). Default timezone: Dubai.

---

## How numbers are made

Every KPI, chart, and breakdown uses the **same filter set** (dates in the selected timezone, channel, agent, subject, CSAT, FRT, subject source). Click a tile → `/conversations` with those filters.

### CSAT

| Tile | Formula | How to say it |
|------|---------|----------------|
| **CSAT response rate** | rated ÷ **all chats** | ~12%. Includes chats that never got a survey. |
| **CSAT on resolved** | rated-among-resolved ÷ resolved | Closer to survey completion **if** Freshchat sends CSAT on resolve. |
| **Avg CSAT / % satisfied / % dissatisfied** | among **rated** only | Dissatisfied = ≤2. |

Industry 20–30% is usually **rated ÷ surveys offered**. We cannot count surveys offered: `csat.survey_id` is only set when a score arrives. Do not chase 20–30% against rated/total.

**Why 1–2★** on Dashboard is the last 50 chats with rating ≤2: comment, opener, keyword themes, label, channel, agent, FRT.

### First response (FRT)

From Extract `First-Response-Time` (seconds), not guessed from timestamps.

| Tile | Meaning |
|------|---------|
| **Avg FRT** | Mean — pulled up by the tail |
| **Median FRT** | Typical wait |
| **p90 FRT** | Slow tail |
| **% FRT > 2 min** | Share with FRT ≥ 120s (industry SLA). Click → `frt=over120` |

Histogram buckets are `<1m`, **`1–2m`**, **`2–5m`**, then longer. The old `1–5m` bucket hid the 2 min SLA.

### Labels vs derived subject

| Field | Who writes it | KPI |
|-------|----------------|-----|
| `resolution.label` | Freshchat **agent tag** | **Label coverage** — never keyword |
| `derived.subject` | Agent tag if present, else keyword if `CLASSIFY_ENABLED` | **Derived coverage** |
| `derived.subject_source` | `resolution_label` / `keyword` / `none` | Filter **Subject source** |

Classifier **never** updates Freshchat. `npm run reclassify -- --force` only rewrites `derived` in local Mongo.

Keyword taxonomy lives in `lib/classify/taxonomy.ts` (pause, renew, swap, missed delivery, address, bags, promo, quality, …). Agent label always wins. Greetings and empty text stay `none`. There is **no ML model**. `CLASSIFY_LLM_ENABLED` is unused; LLM is only a later option for the leftover `none` rows after Neeta audits names.

---

## Customer + orders (chat sidebar)

Join path (lookup, do not guess):

```
Freshchat user phone | email | reference_id
  → platform Customer  (needs PLATFORM_MONGODB_URI)
  → analytics MySQL     (needs ANALYTICS_MYSQL_URI — not wired yet)
```

| Sidebar status | Meaning |
|----------------|---------|
| **Not configured** | Env empty — expected on local today |
| **Unmatched** | No platform customer for that phone/email |
| **Ambiguous** | Several hits — we do **not** attach |
| **Matched** | Orders, spent, AOV from platform `customer` |

---

## Chat risk (`/outcomes`) vs real churn

`/outcomes` uses the same chat KPIs. “Risk” = subjects that look like pause / skip / cancel / refund / complaint / renew **language**.

That is **not** “did the subscription fail to renew.” True non-renewal / AOV at +30d / +60d needs analytics MySQL (`ANALYTICS_MYSQL_URI`). Until then the page says so in the amber banner. Observational only — no causal claim.

---

## Phone Sales (`/sales`) vs ZIWO

`/sales` reuses Dashboard tiles, locked to channel name containing **`ZIWO`** (Freshchat `Phone-ZIWO`).

Those are **chats on a phone channel**, not outbound sales calls. Connect rate, talk-time p50/p90, dispositions, and revenue per agent stay **—** until a ZIWO (or equivalent) export lands in a `calls` collection (`ZIWO_INGEST_URI`). `/dashboard` is unchanged.

---

## What we froze on purpose

- **Experience** and **Demand** briefing questions, MixStrip, ProblemBoard.
- Label coverage = Freshchat tags only.
- No custom ML model in v1.
- No write-back of inferred labels to Freshchat.

---

## How to check (local)

`npm run dev` → http://localhost:3000/dashboard (30 days, Dubai).

1. CSAT response ~12% of all chats; CSAT on resolved is higher; response-rate tile opens **unrated**.
2. % FRT > 2 min opens chats with FRT ≥ 120s. Histogram has 1–2m and 2–5m.
3. 1–2★ board shows comments/openers.
4. Label coverage does not jump when classify is on; derived coverage may be slightly higher.
5. Conversations: **Subject source** + `kw` on inferred rows.
6. Chat sidebar Account / orders = Not configured (until platform Mongo).
7. `/outcomes` amber text: churn **talk**, not non-renewal.
8. `/sales`: Phone-ZIWO chats; connect / talk / revenue = —.
9. `/insights/cx` and `/insights/marketing` still have the same five briefing questions.
