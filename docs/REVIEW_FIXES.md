# Deep review findings & fixes

Audit of the Freshchat analytics dashboard (correctness / data accuracy first).

## Fixed in this pass

| Issue | Fix |
|-------|-----|
| Search `q` overwrote subject `$or` filter | Filters compose with `$and` only |
| Daily “Resolved” chart used `created_at` | Resolved series buckets by `resolved_at` |
| Label merge set `resolved: true` | Labels only store label fields; resolve comes from `Conversation-Resolved` |
| Transcript used sorted agent id as assignee | Assignee only from prior/Created/Resolved; not invented |
| `primary_user_id` from sorted ids | Prefer Freshchat `customer_id` |
| CSAT overwrite of assignee | CSAT no longer overwrites existing agent |
| Unmapped CSAT failed whole window | Bad rows skipped; window continues |
| Stub orphans inflated KPIs | Default match excludes empty stubs |
| Export silent 10k cap | Headers + UI warning when truncated |
| Unauthenticated APIs | Optional `DASHBOARD_API_SECRET` Bearer gate |
| Classify full-table every sync | Delta query for docs that need subjects |
| Inbox list no pagination | Prev/Next in Team Inbox sidebar |

## Still known (acceptable for local / later)

- Date pickers are **UTC calendar days** (`REPORTING_TIMEZONE` is display-only)
- Long chats may truncate middle messages (`MAX_EMBEDDED_MESSAGES`)
- One failed Extract window pins the contiguous cursor (by design — retry next run)
- Extract quota may be account-wide; we track per-event as Freshchat docs say
- Full auth UI (login) not built — use `DASHBOARD_API_SECRET` + network ACL before public deploy

## How to verify

```bash
npx tsc --noEmit
npm run db:init
npm run sync -- --lookback=3   # needs credentials
npm run verify
npm run dev
```
