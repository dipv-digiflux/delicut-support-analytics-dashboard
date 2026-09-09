# Dashboard — data sources & KPIs

This document lists **what data** the dashboard uses and **every KPI / chart / breakdown** shown on `/dashboard`, with formulas and notes.  
All numbers come from **synced Freshchat Extract reports** stored in local MongoDB — we do not invent CSAT, labels, or SLA times.

Related: [ENV.md](./ENV.md) · [SYNC.md](./SYNC.md) · [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md)

---

## 1. Where the data comes from

| Freshchat Extract event | What it gives us | Used for |
|-------------------------|------------------|----------|
| `Chat-Transcript` | Messages, actors, channel, customer/agent ids | Chat history, message counts, user discovery |
| `CSAT-Score` | Rating value, comment, submit time, agent | Avg CSAT, satisfied %, distribution |
| `Conversation-Resolution-Label` | Category / subcategory at resolve | Label coverage, “by label” chart, subject |
| `Conversation-Created` | Create time, channel, group, agent, reopen flag | Volume, channel/group dims |
| `Conversation-Resolved` | Resolve time, agent, group | Resolution rate, resolve timestamps |
| `First-Response-Time` | Seconds to first response | Avg FRT (overall + breakdowns) |
| `Resolution-Time` | Seconds to resolve | Avg resolution time |
| `Response-Time` | Response latency (stored when synced) | Future / detail views |

**Users** are enriched via Freshchat `POST /v2/users/fetch` (name, email, phone, properties) — still Freshchat source data.

### Storage (as-is policy)

- One Mongo document per Freshchat `conversation_id`
- CSAT keeps `rating` (normalized 1–5 when possible) **and** `rating_raw` from CSV
- Resolution labels stored exactly as Freshchat category / subcategory
- Message rows keep original CSV columns in `messages[].raw`
- `CLASSIFY_ENABLED=false` by default → subject on UI = Freshchat label only (empty if unlabeled)

---

## 2. Filters (apply to all KPIs below)

| Filter | Meaning |
|--------|---------|
| **From / To** | Filter on conversation `created_at` as **calendar days in the selected timezone** (header: Dubai / IST / UTC; default Dubai). Converted to UTC for Mongo. |
| **Subject / label** | Freshchat resolution label (`derived.subject`), or `unlabeled` |
| **Agent** | `assigned_agent_id` (or `unassigned`) |
| **Channel** | Exact `channel_name` |
| **Group** | Exact `group_name` |
| **Resolved** | `true` / `false` |
| **CSAT** | `rated` / `unrated` / `1`–`5` / `satisfied` (≥4) / `dissatisfied` (≤2) |

Changing filters recalculates **every** KPI, chart, and breakdown for the same matched set.

---

## 3. Overall KPI cards

| KPI on UI | Formula / definition | Notes |
|-----------|----------------------|-------|
| **Conversations** | `COUNT(*)` in filter | One row per Freshchat conversation |
| **Unique users** | `COUNT DISTINCT primary_user_id` | Null user ids excluded |
| **Resolution rate** | `resolved=true` / total | From Freshchat resolved flag / resolve report |
| **Reopen rate** | `reopened=true` / total | From Freshchat reopen field when present |
| **Avg CSAT** | `AVG(csat.rating)` where rating not null | Footnote: “Based on X of Y rated” |
| **% Satisfied (≥4)** | `csat ≥ 4` / rated count | Denominator = rated only |
| **CSAT response rate** | rated count / total | Share of chats that got a score |
| **Label coverage** | has non-empty resolution label / total | Freshchat labels only |
| **Avg messages / chat** | `SUM(message_count) / total` | From transcript |
| **Avg first response** | `AVG(metrics.first_response_time_seconds)` | Only chats with FRT from Extract |
| **Avg resolution time** | `AVG(metrics.resolution_time_seconds)` | Only chats with resolution-time report |
| **Unassigned chats** | no `assigned_agent_id` | Also shows % of total |
| **Agents in range** | distinct agents in agent breakdown | After filters |
| **Channels in range** | distinct channels in channel breakdown | After filters |

### Display rules

- If denominator is 0 → show **—** (not 0%)
- Times shown as seconds / minutes / hours for readability
- CSAT averages always show **rated n** when relevant

---

## 4. Charts

| Chart | Data | How to read it |
|-------|------|----------------|
| **Daily conversation volume** | Created count by `created_at` day; resolved count by `resolved_at` day | Demand vs close-out (not “created that day and later resolved”) |
| **Daily CSAT trend** | Avg CSAT by rating date (fallback created date) | Quality over time; point has rated n |
| **CSAT distribution** | Counts of scores 1–5 | Shape of satisfaction |
| **By channel** | Conversation count per `channel_name` | Where volume lands |
| **By Freshchat label** | Count per resolution label | Topic mix (unlabeled bucket if empty) |
| **Who’s responding — volume** | Chats per assigned agent | Workload |
| **Avg CSAT by agent** | Avg CSAT per agent | Quality by responder (`*` if n &lt; 3) |

---

## 5. In-depth breakdown tables

Each row is one **channel**, **agent**, or **group**. Same metric columns:

| Column | Meaning |
|--------|---------|
| **Chats** | Conversations in this dimension |
| **Resolved %** | Resolved / chats |
| **Reopen %** | Reopened / chats |
| **Avg CSAT** | Average rating (shows `n=` rated) |
| **Satisfied %** | Score ≥ 4 / rated |
| **CSAT resp %** | Rated / chats |
| **Avg msgs** | Average message count |
| **Avg FRT** | Average first-response seconds |
| **Avg resolve** | Average resolution-time seconds |

### 5.1 By channel

- Dimension: Freshchat `channel_name` (e.g. Web chat, WhatsApp, Instagram)
- Answers: *Which channel has volume, slow FRT, or weak CSAT?*

### 5.2 By who’s responding (agent)

- Dimension: Freshchat `assigned_agent_id` / `assigned_agent_name` (or **Unassigned**)
- Answers: *Who handles how many chats, and with what CSAT / speed?*

### 5.3 By group

- Dimension: Freshchat `group_name` / `group_id`
- Answers: *How do L1 / L2 / regional queues compare?*

---

## 6. Other surfaces (related data, not only KPI cards)

| Page | Data shown |
|------|------------|
| **`/conversations` (Raw data)** | Flat table: date, user, channel, label, agent, resolved, CSAT, msgs, FRT + **CSV export** |
| **`/conversations/[id]`** | Full transcript + user/agent/CSAT/label/SLA sidebar |
| **`/inbox` (Team Inbox UI)** | Freshchat-style list + chat + contact properties (read-only from sync) |
| **`/api/kpis`** | JSON for all KPIs + charts + breakdowns |
| **`/api/sync-status`** | Last sync state / freshness |

---

## 7. What is *not* on the dashboard (yet)

These exist in Freshchat or our sync plan but are not primary dashboard KPIs today:

- Live “agents online” (Metrics Instant API)
- Business-hours vs calendar FRT split (we store one seconds field when present)
- Bot vs human message share as a KPI card (data is in transcripts; chart TBD)
- Priority field (only if present in your Extract/account — not always in raw reports)

We can add any of these once the corresponding Freshchat fields are confirmed in your exports.

---

## 8. Accuracy checklist

Before trusting a number:

1. Sync completed for the date range (`npm run sync` / `sync:year`).
2. Filters match the question (e.g. channel + date).
3. For CSAT / FRT / resolve time: check **rated n** or whether that Extract event was included in `SYNC_EVENTS`.
4. Re-run sync twice → counts should stay stable (upsert + hash skip).
5. Spot-check 1–2 conversations in Freshchat UI vs `/inbox` or detail page.

---

## 9. Quick map: business question → where to look

| Question | Look at |
|----------|---------|
| How busy were we? | Conversations, daily volume |
| Are we closing chats? | Resolution rate, daily created vs resolved |
| Are customers happy? | Avg CSAT, % satisfied, distribution |
| Do people rate us? | CSAT response rate |
| Which channel is worst? | Channel breakdown table |
| Which agent needs coaching? | Agent breakdown + CSAT by agent chart |
| Are labels used? | Label coverage + by-label chart |
| Are we slow? | Avg FRT, avg resolution time (overall + breakdowns) |
| Who is overloaded? | Agent volume chart + agent table “Chats” |
| Export for Excel? | Raw data → Export CSV |

---

*Last updated to match the current `/dashboard` implementation (overall KPIs, charts, channel/agent/group breakdowns).*
