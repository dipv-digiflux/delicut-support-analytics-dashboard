# Dashboard — data sources & KPIs (Updated)

This document lists **what data** the dashboard uses and **every KPI / chart / breakdown** shown on `/dashboard`, with formulas and notes.
All numbers come from **synced Freshchat Extract reports** stored in local MongoDB — we do not invent CSAT, labels, or SLA times.

> 🆕 = new in this update, either promoted from "not yet on dashboard" or newly proposed.
> ✅ = confirmed against Freshchat's own Extract API / Instant Metrics API documentation — these report types genuinely exist and are pullable today, not speculative.
> 🟢 = implemented in this app against currently synced conversation data.
> 📋 = documented / planned — needs new sync events, collections, or Instant Metrics before UI can ship.

Related: [ENV.md](./ENV.md) · [SYNC.md](./SYNC.md) · [FRESHCHAT_ADMIN_CHECKLIST.md](./FRESHCHAT_ADMIN_CHECKLIST.md)

---

## 0. Drill-down (live)

Dashboard **KPI tiles**, **charts**, and **breakdown row names** link to `/conversations` with the **current date range + timezone + active filters**, plus a dimension patch from what you clicked (channel, agent, label, CSAT score, resolved flag, single day, etc.).

That way users can go from a tile/chart straight into the raw rows that produced the number.

---

## 1. Where the data comes from

| Freshchat Extract event | What it gives us | Used for |
|-------------------------|------------------|----------|
| `Chat-Transcript` | Messages, actors, channel, customer/agent ids | Chat history, message counts, user discovery, bot/human split 🆕 |
| `CSAT-Score` | Rating value, comment, submit time, agent | Avg CSAT, satisfied %, distribution, comment sentiment 🆕 |
| `Conversation-Resolution-Label` | Category / subcategory at resolve | Label coverage, "by label" chart, subject, label trend over time 🆕 |
| `Conversation-Created` | Create time, channel, group, agent, reopen flag | Volume, channel/group dims, new vs returning customer 🆕 |
| `Conversation-Resolved` | Resolve time, agent, group | Resolution rate, resolve timestamps, backlog/open count 🆕 |
| `First-Response-Time` | Seconds to first response | Avg/median FRT (overall + breakdowns) |
| `Resolution-Time` | Seconds to resolve | Avg/median resolution time |
| `Response-Time` | Response latency (stored when synced) | Handle time, per-message latency 🆕 |
| `Conversation-Priority` 🆕 | Priority field, if present in account/export | Priority breakdown |
| `Business-Hours Calendar` (config, not Freshchat event) 🆕 | Working-hours definition per group/timezone | Business-hours FRT/SLA split |
| `Conversation-Agent-Assigned` ✅ | Timestamp + agent id when a conversation gets assigned | Time-to-assignment, assignment mix 🆕 |
| `Conversation-Group-Assigned` ✅ | Timestamp + group id when a conversation gets routed to a group | Routing accuracy, group transfer rate 🆕 |
| `Message-Sent` ✅ | Per-message event: sender, timestamp, channel | Messages/agent, response cadence, replaces some Chat-Transcript uses 🆕 |
| `Agent-Activity` ✅ | Agent login/logout/status-change timestamps | Agent online time, utilization % 🆕 |
| `Agent-Intelliassign-Activity` ✅ | Auto-assignment events from Freshchat's Intelliassign engine | Auto vs manual assignment mix 🆕 |
| `Team-Performance-Report` ✅ | Freshchat's own team-level rollup (volume, FRT, resolution, CSAT per team) | Team performance summary page 🆕 |
| `Interaction-Report` ✅ | Count/type of customer-agent interaction touches per conversation | Interaction count, multi-touch chats 🆕 |
| Freshchat **Instant Metrics API** ✅ (separate from Extract, near real-time) | Live agent presence: online / away / busy, plus current active-chat counts | Agents-online live tile 🆕 |

**Users** are enriched via Freshchat `POST /v2/users/fetch` (name, email, phone, properties) — still Freshchat source data.

### Storage (as-is policy)

- One Mongo document per Freshchat `conversation_id`
- CSAT keeps `rating` (normalized 1–5 when possible) **and** `rating_raw` from CSV
- Resolution labels stored exactly as Freshchat category / subcategory
- Message rows keep original CSV columns in `messages[].raw`, including `sender_type` (bot/agent/customer) 🆕
- Priority stored as-is when the field exists in the export; otherwise left null 🆕
- Agent-Activity and Intelliassign events stored as a separate `agent_activity` collection keyed by agent id + timestamp, not nested under conversations ✅🆕
- Team-Performance-Report stored as a daily snapshot per team (`team_daily_snapshots`), since it's Freshchat's own pre-aggregated rollup rather than per-conversation data ✅🆕
- `CLASSIFY_ENABLED=false` by default → subject on UI = Freshchat label only (empty if unlabeled)

---

## 2. Filters (apply to all KPIs below)

| Filter | Meaning |
|--------|---------|
| **From / To** | Filter on conversation `created_at` as **calendar days in the selected timezone** (header: Dubai / IST / UTC; default Dubai). Converted to UTC for Mongo. |
| **Subject / label** | Freshchat resolution label (`derived.subject`), or `unlabeled` |
| **Agent** | `assigned_agent_id` (or `unassigned`) |
| **Channel** | Exact `channel_name` / `channelId` multi-select |
| **Group** | Exact `group_name` |
| **Resolved** | `true` / `false` |
| **CSAT** | `rated` / `unrated` / `1`–`5` / `satisfied` (≥4) / `dissatisfied` (≤2) |
| **Priority** 🆕📋 | `low` / `medium` / `high` / `urgent` / `none` (only if field present) |
| **Business hours** 🆕📋 | `in-hours` / `after-hours`, based on group's calendar |
| **Bot involvement** 🆕📋 | `bot-only` / `bot-then-agent` / `agent-only` |

Changing filters recalculates **every** KPI, chart, and breakdown for the same matched set.

---

## 3. Overall KPI cards

| KPI on UI | Formula / definition | Notes | Status |
|-----------|----------------------|-------|--------|
| **Conversations** | `COUNT(*)` in filter | One row per Freshchat conversation | 🟢 |
| **Unique users** | `COUNT DISTINCT primary_user_id` | Null user ids excluded | 🟢 |
| **New vs returning users** 🆕 | New = first-ever conversation in range; Returning = user has ≥1 prior conversation | Shown as split % | 📋 |
| **Resolution rate** | `resolved=true` / total | From Freshchat resolved flag / resolve report | 🟢 |
| **First Contact Resolution (FCR)** 🆕 | Resolved in 1 conversation with no reopen and no follow-up conversation from same user within 24–72h (configurable) | Approximation — flagged as "derived", not raw Freshchat field | 📋 |
| **Reopen rate** | `reopened=true` / total | From Freshchat reopen field when present | 🟢 |
| **Repeat contact rate** 🆕 | Users with >1 conversation within N days (default 7) / unique users | Signals unresolved root cause | 📋 |
| **Backlog (open chats)** 🆕 | `resolved=false` in filter (open count) | Dashboard shows open chats for filtered set; true “as of now” backlog is 📋 | 🟢 / 📋 |
| **Avg CSAT** | `AVG(csat.rating)` where rating not null | Footnote: "Based on X of Y rated" | 🟢 |
| **% Satisfied (≥4)** | `csat ≥ 4` / rated count | Denominator = rated only | 🟢 |
| **% Dissatisfied (≤2)** 🆕 | `csat ≤ 2` / rated count | Pairs with satisfied % for full picture | 🟢 |
| **CSAT response rate** | rated count / total | Share of chats that got a score | 🟢 |
| **Label coverage** | has non-empty resolution label / total | Freshchat labels only | 🟢 |
| **Avg messages / chat** | `SUM(message_count) / total` | From transcript | 🟢 |
| **Bot deflection rate** 🆕 | `bot-only` conversations / total | Chats fully handled without an agent | 📋 |
| **Avg first response** | `AVG(metrics.first_response_time_seconds)` | Only chats with FRT from Extract | 🟢 |
| **Median first response** 🆕 | `MEDIAN(metrics.first_response_time_seconds)` | Less skewed by outliers than avg | 🟢 |
| **Avg resolution time** | `AVG(metrics.resolution_time_seconds)` | Only chats with resolution-time report | 🟢 |
| **Median resolution time** 🆕 | `MEDIAN(metrics.resolution_time_seconds)` | Less skewed by outliers than avg | 🟢 |
| **SLA breach rate** 🆕 | FRT or resolution time > configured SLA threshold / total with that metric | Threshold set per group/priority in config | 📋 |
| **Business-hours avg FRT** 🆕 | Avg FRT recalculated using only business-hours elapsed time | Requires business-hours calendar per group | 📋 |
| **Unassigned chats** | no `assigned_agent_id` | Also shows % of total | 🟢 |
| **Agents in range** | distinct agents in agent breakdown | After filters | 🟢 |
| **Agents online now** ✅🆕 | Live count from Instant Metrics API | Not date-filtered; refreshes independently | 📋 |
| **Channels in range** | distinct channels in channel breakdown | After filters | 🟢 |
| **Priority mix** 🆕 | Count by priority value | "—" shown if priority field absent in account | 📋 |
| **Avg time to assignment** ✅🆕 | `AVG(assigned_at − created_at)` from `Conversation-Agent-Assigned` | Time a chat sits unassigned, distinct from FRT | 📋 |
| **Auto-assignment rate** ✅🆕 | Intelliassign-routed conversations / total assigned | From `Agent-Intelliassign-Activity` | 📋 |
| **Group transfer rate** ✅🆕 | Conversations with >1 `Conversation-Group-Assigned` event / total | Flags misrouting between queues | 📋 |
| **Agent utilization %** ✅🆕 | Agent's `online` time actively in a chat / total `online` time, from `Agent-Activity` | Distinct from CSAT/speed — measures idle vs busy online time | 📋 |
| **Avg interactions / chat** ✅🆕 | `AVG(interaction_count)` from `Interaction-Report` | Back-and-forth touches, complements "avg messages/chat" | 📋 |

### Display rules

- If denominator is 0 → show **—** (not 0%)
- Times shown as seconds / minutes / hours for readability
- CSAT averages always show **rated n** when relevant
- Derived/approximated metrics (FCR, repeat contact) show a small "derived" badge and one-line methodology on hover 🆕📋
- Live metrics (agents online, backlog) show a "as of HH:MM" timestamp instead of date range 🆕📋
- Clickable tiles open `/conversations` with matching filters 🟢

---

## 4. Charts

| Chart | Data | How to read it | Status |
|-------|------|----------------|--------|
| **Daily conversation volume** | Created count by `created_at` day; resolved count by `resolved_at` day | Demand vs close-out | 🟢 + click → that day |
| **Daily CSAT trend** | Avg CSAT by rating date (fallback created date) | Quality over time; point has rated n | 🟢 + click → that day |
| **CSAT distribution** | Counts of scores 1–5 | Shape of satisfaction | 🟢 + click → `csat=N` |
| **By channel** | Conversation count per `channel_name` | Where volume lands | 🟢 + click → channel |
| **By Freshchat label** | Count per resolution label | Topic mix (unlabeled bucket if empty) | 🟢 + click → subject |
| **Label trend over time** 🆕 | Count per label, stacked by day/week | Are certain issue types rising or falling? | 🟢 top-5 line trend |
| **Who's responding — volume** | Chats per assigned agent | Workload | 🟢 + click → agent |
| **Avg CSAT by agent** | Avg CSAT per agent | Quality by responder (`*` if n < 3) | 🟢 + click → agent |
| **Bot vs human message share** 🆕 | % of messages by `sender_type` | Automation coverage | 🟢 actor doughnut |
| **Volume heatmap (day × hour)** 🆕 | Conversation count by weekday and hour | Staffing / peak-time planning | 🟢 |
| **FRT distribution** 🆕 | Histogram of first-response seconds | Shows tail/outliers avg hides | 🟢 |
| **Resolution time distribution** 🆕 | Histogram of resolve seconds | Close-out speed shape | 🟢 |
| **Resolved vs open** 🆕 | Doughnut of resolved/open | Pipeline mix | 🟢 |
| **Avg CSAT by channel** 🆕 | Channel CSAT averages | Channel quality | 🟢 |
| **SLA breach trend** 🆕 | Daily % of chats breaching SLA | Track SLA health over time | 📋 |
| **Priority mix over time** 🆕 | Stacked count by priority per day | Only if priority field present | 📋 |
| **Time-to-assignment distribution** ✅🆕 | Histogram of `assigned_at − created_at` | Handoff delay | 📋 |
| **Auto vs manual assignment trend** ✅🆕 | Daily % Intelliassign vs manual | Automation adoption | 📋 |
| **Agent online vs active time** ✅🆕 | Stacked bar from `Agent-Activity` | Utilization | 📋 |

---

## 5. In-depth breakdown tables

Each row is one **channel**, **agent**, or **group**. Same metric columns (row name is clickable → conversations 🟢):

| Column | Meaning | Status |
|--------|---------|--------|
| **Chats** | Conversations in this dimension | 🟢 |
| **Resolved %** | Resolved / chats | 🟢 |
| **Reopen %** | Reopened / chats | 🟢 |
| **Avg CSAT** | Average rating (shows `n=` rated) | 🟢 |
| **Satisfied %** | Score ≥ 4 / rated | 🟢 |
| **CSAT resp %** | Rated / chats | 🟢 |
| **Avg msgs** | Average message count | 🟢 |
| **Avg FRT** | Average first-response seconds | 🟢 |
| **Median FRT** 🆕 | Median first-response seconds | 📋 (overall KPI has median; per-row 📋) |
| **Avg resolve** | Average resolution-time seconds | 🟢 |
| **Median resolve** 🆕 | Median resolution-time seconds | 📋 |
| **SLA breach %** 🆕 | Breaches / chats with SLA-eligible metric | 📋 |
| **Avg handle time** 🆕 | Sum of agent response-time gaps per chat, averaged | 📋 |
| **FCR %** 🆕 | Derived first-contact-resolution rate | 📋 |
| **Avg time to assignment** ✅🆕 | Average `assigned_at − created_at` | 📋 |
| **Auto-assigned %** ✅🆕 | Share routed via Intelliassign | 📋 |

### 5.1–5.3 By channel / responder / group — 🟢 live

### 5.4 By priority 🆕📋 / 5.5 By team ✅🆕📋 — planned (need priority field / Team-Performance-Report sync)

---

## 6. Other surfaces (related data, not only KPI cards)

| Page | Data shown | Status |
|------|------------|--------|
| **`/conversations` (Raw data)** | Flat table + CSV export; receives dashboard drill-down query | 🟢 |
| **`/conversations/[id]`** | Full transcript + profile | 🟢 |
| **`/users` / `/users/[id]`** | Customers + chat history | 🟢 |
| **`/api/kpis`** | JSON for all KPIs + charts + breakdowns | 🟢 |
| **`/api/sync-status`** | Last sync state / freshness | 🟢 |
| **`/agents/live`** ✅🆕 | Instant Metrics live presence | 📋 |
| **`/teams`** ✅🆕 | Team-Performance-Report cross-check | 📋 |

---

## 7. What is *still not* on the dashboard

Remaining open items (see 📋 rows above), plus:

- Full sentiment analysis on CSAT comments
- Cross-channel identity stitching
- Custom SLA policies per customer tier
- Anomaly/alerting
- Reconciling `Team-Performance-Report` "team" vs `group_name`

---

## 8. Accuracy checklist

1. Sync completed for the date range (`npm run sync` / `sync:year`).
2. Filters match the question (e.g. channel + date + priority 🆕).
3. For CSAT / FRT / resolve time: check **rated n** or whether that Extract event was included in `SYNC_EVENTS`.
4. For derived metrics (FCR, repeat contact, SLA breach) 🆕: confirm methodology badge/tooltip.
5. For business-hours metrics 🆕: confirm the group's calendar is configured.
6. For assignment/activity/team metrics ✅🆕: confirm those events are enabled in `SYNC_EVENTS`.
7. Re-run sync twice → counts should stay stable (upsert + hash skip).
8. Spot-check 1–2 conversations in Freshchat UI vs detail page.
9. Drill-down: click a chart/KPI → confirm `/conversations` rows match the slice.

---

## 9. Quick map: business question → where to look

| Question | Look at |
|----------|---------|
| How busy were we? | Conversations, daily volume |
| Are we closing chats? | Resolution rate, daily created vs resolved, open chats |
| Are customers happy? | Avg CSAT, % satisfied, % dissatisfied, distribution |
| Do people rate us? | CSAT response rate |
| Which channel is worst? | Channel breakdown + click into conversations |
| Which agent needs coaching? | Agent breakdown + CSAT by agent chart |
| Are labels used? | Label coverage + by-label chart |
| Are we slow? | Avg/median FRT, avg/median resolution |
| Who is overloaded? | Agent volume chart |
| Export for Excel? | Conversations → Export CSV |
| See the raw chats behind a number? | Click the KPI / chart / breakdown row 🟢 |

---

## 10. Summary of changes in this update

**Round 1 (proposed, 🆕 only):** New KPIs/charts/filters for FCR, SLA, bot, priority, heatmaps, etc. — many still 📋 until data exists.

**Round 2 (✅ against Freshchat docs):** Assignment, agent activity, team report, Instant Metrics — confirmed real, still 📋 until synced for this account.

**Round 3 (this codebase):**
- Doc updated with status tags (🟢 / 📋).
- Dashboard drill-down: KPI tiles, charts, and breakdown names navigate to `/conversations` with date range + dimension filters preserved.
- Existing live KPIs (including medians, dissatisfied %, open chats, attachments, groups) remain the source of truth until new Extract events are enabled in `SYNC_EVENTS`.

*Items marked 🆕 only are proposed. Items marked ✅🆕 are confirmed Freshchat types but still need account enablement + sync before UI. Items marked 🟢 are live against current Mongo warehouse.*
