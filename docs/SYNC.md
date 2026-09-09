# Sync design (summary)

Standalone script: `npm run sync` → `scripts/sync.ts` → `lib/sync/run.ts`.

## Pipeline

`PLAN → FETCH → MERGE → ENRICH → CLASSIFY → FINALIZE`

## Windowing

| Event | Max span | Notes |
|-------|----------|-------|
| Chat-Transcript | 24h (UTC days) | Hot = today, always re-fetched |
| CSAT-Score | ≤28d slices | Cursor moves by **rating date** |
| Conversation-Resolution-Label | ≤28d slices | Same |

Ledger: `sync_windows` with deterministic `_id`. Budget: 1 POST/min, 120/day/event in `sync_state`.

## Idempotency

- Upsert by Freshchat conversation/user `_id`
- Three hashes: `sources.transcript|csat|label.hash`
- Messages merged by `message_id`
- Unchanged hashes → no write

## Verify

```bash
npm run sync -- --lookback=3
npm run sync -- --lookback=3   # expect unchanged
npm run verify -- --checks
```

## Logs

Sync writes NDJSON under `logs/` by default (`sync-latest.log`, daily, `runs/<run_id>.log`). See [LOGGING.md](./LOGGING.md).

## Clean re-sync (e.g. Sep 1–5)

```bash
npm run db:reset -- --confirm=freshchat_analytics --logs --cache
npm run db:init
npm run sync -- --mode=backfill \
  --since=2026-09-01T00:00:00.000Z \
  --until=2026-09-06T00:00:00.000Z
```
