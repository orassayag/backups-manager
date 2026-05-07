# backups-manager

A cross-platform (Windows / macOS / Ubuntu) TypeScript tool that backs up files via:

- **Full backup** — copies every file from source to all targets (with exclusions applied).
- **Diff backup** — copies only files that changed since the last run, using a persistent cache and size+mtime comparison.

Both modes show a live progress spinner (time elapsed, percentage, current file) and write a `BACKUP_REPORT.txt` to the Desktop when finished.

---

## Quick start

```bash
# Install dependencies
npm install

# Run interactively
npm start
# or on Windows:
run.bat

# Run automatically (for Task Scheduler / cron)
npm run start:auto
# or on Windows:
run-auto.bat
```

---

## Configuration — `src/settings.ts`

Edit this file before first use:

| Field | Description |
|---|---|
| `sourcePath` | Root directory to back up (all sub-directories included recursively) |
| `targetPaths` | Array of destination paths — at least one required |
| `excludeNames` | Exact file/folder names to skip (`node_modules`, `.git`, …) |
| `excludePatterns` | Glob patterns to skip (`*.log`, `**/__pycache__/**`, …) |
| `automaticMode` | `true` = skip menu, run `automaticOperation` immediately |
| `automaticOperation` | `'full'` or `'diff'` — used when `automaticMode` is `true` |

---

## How it works

### Full backup

1. Scans the source directory recursively (exclusions applied).
2. Copies every file to each target path, creating directories as needed.
3. Failed copies are recorded and included in the report.

### Diff backup — smart change detection

The diff backup uses a **two-layer strategy** for efficiency:

1. **Persistent cache** (`.backup-cache.json` in the source root)  
   Stores the `size` and `mtime` of every backed-up file. On subsequent runs, only files whose size or mtime differs from the cache are considered changed — the OS stat call is very fast, so even millions of files are scanned in seconds without reading any content.

2. **Target scan**  
   Files present in the target but absent in the source are queued for deletion, so the target stays in sync with the source.

This means after the first run, nightly backups only do real disk I/O on files that actually changed.

### Progress display

```
Time: 00:03:32 | Scanning...
Time: 00:03:32 | 34.4% | Copying /path/to/source to /path/to/target
```

### Report (BACKUP_REPORT.txt on Desktop)

After every operation a report is written to the Desktop with:
- Date/time (Jerusalem timezone, `dd/MM/yyyy HH:mm:ss`)
- Duration, source, targets
- List of failed files (if any)
- For diff backup: a table of added / updated / deleted files

---

## Windows Task Scheduler setup

1. Open **Task Scheduler** → Create Basic Task.
2. Set the trigger (e.g. Daily at 02:00).
3. Action: **Start a program**  
   Program: `cmd.exe`  
   Arguments: `/c "C:\path\to\backups-manager\run-auto.bat"`
4. Make sure `automaticMode: true` in `settings.ts`.

---

## Project structure

```
backups-manager/
├── src/
│   ├── index.ts        ← Entry point
│   ├── settings.ts     ← All configuration (edit this)
│   ├── types.ts        ← Shared TypeScript interfaces
│   ├── utils.ts        ← Path helpers, exclusion logic, scanDirectory
│   ├── validator.ts    ← Settings validation (exits on error)
│   ├── menu.ts         ← Interactive inquirer menu
│   ├── progress.ts     ← ora spinner / progress tracker
│   ├── fullBackup.ts   ← Full backup logic
│   ├── diffBackup.ts   ← Diff backup logic + cache management
│   └── reporter.ts     ← BACKUP_REPORT.txt generator
├── run.bat             ← Windows interactive launcher
├── run-auto.bat        ← Windows automatic launcher (Task Scheduler)
├── tsconfig.json
└── package.json
```
