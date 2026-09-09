# Logging — sync logs & file management

Sync prints to the **terminal** and (by default) writes **JSON lines** to files under `logs/`.

## Layout

```text
logs/
  sync-latest.log          # this process’s live/latest run (overwritten each sync)
  sync-2026-09-09.log      # daily append log (all runs that day)
  runs/
    01JXXXX….log           # one file per sync run_id (best for debugging one job)
```

- Format: **NDJSON** (one JSON object per line) — easy to `grep` / `jq`
- Secrets (Bearer tokens) are redacted if they appear in a message
- `logs/` is gitignored — never commit logs

## Config (`.env` / `.env.local`)

| Variable | Default | Meaning |
|----------|---------|---------|
| `LOG_TO_FILE` | `true` | Write files as well as console |
| `LOG_DIR` | `logs` | Folder for log files |
| `LOG_RETENTION_DAYS` | `14` | Auto-delete older `*.log` on each sync start |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `auto` | Console style: `tty` colors / `json` / `auto` |

```bash
LOG_TO_FILE=true
LOG_DIR=logs
LOG_RETENTION_DAYS=14
LOG_LEVEL=info
```

## Commands

```bash
# Normal sync — creates/updates log files automatically
npm run sync -- --lookback=3

# List log files
npm run logs:list

# Manually prune old logs (also runs at start of each sync)
npm run logs:prune

# Follow today’s log
tail -f logs/sync-latest.log

# Pretty-print last 20 lines
tail -n 20 logs/sync-latest.log | jq .

# Find errors in a run
grep '"level":"error"' logs/runs/<runId>.log | jq .
```

## Best practices

1. **Use per-run files** (`logs/runs/<id>.log`) when a sync fails — share that file, not the whole daily log.
2. **Keep retention** at 7–14 days locally; increase only if you need audit history.
3. **Don’t log tokens** — put secrets only in `.env.local`; logger redacts Bearer strings as a safety net.
4. **Disk**: Extract CSV cache is separate (`.cache/extracts/`). Logs are small; caches can grow — prune cache if needed.
5. **Cron later**: redirect is optional; file logging already captures history:
   ```bash
   0 2 * * * cd /path/to/freshchat-dashboard && npm run sync >> /dev/null 2>&1
   ```

## Related

- Sync status in Mongo: `sync_runs` collection (counters / errors per run)
- CSV cache: `EXTRACT_CACHE_DIR` (default `.cache/extracts`)
