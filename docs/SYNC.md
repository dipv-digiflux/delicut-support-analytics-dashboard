# Sync design (summary)

How data is fetched, what is stored, and the warehouse layout: [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md).

Standalone script: `npm run sync` → `scripts/sync.ts` → `lib/sync/run.ts`.

Multi-day backfill: `npm run sync:campaign` → ledger + `sync_campaigns` checkpoint.

## Pipeline

`PLAN → FETCH → MERGE → ENRICH → CLASSIFY → FINALIZE`

## Windowing

| Event | Max span | Notes |
|-------|----------|-------|
| Chat-Transcript | 24h (UTC days) | Hot = today, always re-fetched |
| CSAT-Score | ≤28d slices | Cursor moves by **rating date** |
| Conversation-Resolution-Label | ≤28d slices | Same |
| Conversation-Created / Resolved / FRT / Resolution-Time | ≤28d slices | Same |

Ledger: `sync_windows` with deterministic `_id`. Budget: 1 POST/min, 120/day/event in `sync_state`.

Progress: `sync_campaigns` stores `stats` + `checkpoint` (next pending day). Merged windows are **never** re-fetched unless `--force`.

## Checkpoint / resume (safe re-run)

Older days barely change. Once a window status is `merged`, the next run **skips** it.

1. Campaign plans the full `[since, until)` once.
2. Work is selected **newest-first** (`--order=desc`) by default for campaigns.
3. Daily Extract quota (~120 Chat-Transcript jobs) stops the run → status `paused_quota`.
4. Re-run the **same** command tomorrow: resume from `checkpoint.next_window_start`.
5. Do **not** `db:reset` mid-campaign.

Check progress anytime:

```bash
npm run sync:status
npm run sync:status -- --id=dubai-2026-ytd
```

Header badge also shows backfill % / “resume tomorrow”.

## Dubai YTD campaign (1 Jan → 9 Sep 2026 EOD)

Dubai = UTC+4:

- since = `2025-12-31T20:00:00.000Z` (1 Jan 00:00 Dubai)
- until = `2026-09-09T20:00:00.000Z` (10 Sep 00:00 Dubai = after 9 Sep EOD)

```bash
# One-time: ensure indexes (also runs at sync start)
npm run db:init

# Day 1 / 2 / 3 — identical command until status=completed
npm run sync:campaign -- \
  --id=dubai-2026-ytd \
  --since=2025-12-31T20:00:00.000Z \
  --until=2026-09-09T20:00:00.000Z \
  --order=desc

npm run sync:status
```

Expected (~253 transcript days, newest first):

| Day | ~Transcript jobs | Covers (approx) |
|-----|------------------|-----------------|
| 1 | 120 | mid-May → 9 Sep |
| 2 | 120 | mid-Jan → mid-May |
| 3 | ~13 | 1 Jan → mid-Jan |

## Need more data later?

| Need | Command |
|------|---------|
| Pull **newer** days after campaign end | `npm run sync -- --lookback=3` (incremental; hot today re-fetched) |
| Extend campaign **further back** | Same `--id`, earlier `--since=…`, re-run `sync:campaign` (new windows planned; old merged kept) |
| Extend **until** (e.g. through today) | Same `--id`, later `--until=…`, re-run |
| Repair one failed window | Fix error, re-run campaign (failed = pending) or `--force` sparingly |
| Full wipe + redo | only if intentional: `db:reset` then `db:init` then campaign again |

## Idempotency

- Upsert by Freshchat conversation/user `_id`
- Three hashes: `sources.transcript|csat|label.hash`
- Messages merged by `message_id`
- Unchanged hashes → no write

## Indexes (performance)

`npm run db:init` / sync start ensures:

- `conversations`: `created_at`, channel/agent/user filters, `messages.message_id`, etc.
- `sync_windows`: `event + window_start` (±), `event + status + window_start`, drops legacy `time_start` index
- `sync_campaigns`: `status + updated_at`
- `sync_runs` / `users` as before

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
