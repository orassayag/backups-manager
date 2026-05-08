# Instructions

## Setup Instructions

1. Open the project in your IDE (VSCode recommended)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your backup sessions in `src/sessions/sessions.json`.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm** or **pnpm**: For managing packages.
- **Write Access**: Ensure you have permission to write to the target backup directories and your Desktop (for reports).

## Configuration

### Main Settings

Open `src/settings/settings.ts` to configure the global behavior of the application.

#### Production vs Development Mode

- **Interactive Mode**: Run `npm start` to manually select backup operations and see confirmations.
- **Automatic Mode**: Set `automaticMode: true` in `settings.ts` to skip all prompts. This is ideal for scheduled tasks.

#### Goal Settings

*(Repurposed for Backup Operations)*
- **Full Backup**: Copies every file from source to target. Best for initial backups.
- **Differential Backup**: Syncs only changed files. Best for daily use.

#### Method Settings

*(Repurposed for Exclusions)*
- `excludeNames`: Use this to skip specific folders like `node_modules` or `.git`.
- `excludePatterns`: Use glob patterns to skip file types like `*.log` or `**/.DS_Store`.

#### MongoDB Settings

*(Repurposed for Session Paths)*
- `sourcePath`: The directory you want to back up.
- `targetPath`: The destination where the backup will be stored.
- *Note: These are configured per session in `src/sessions/sessions.json`.*

#### Search Settings

*(Repurposed for CLI Overrides)*
- `--auto`: Force automatic mode via command line.
- `--operation=full` or `--operation=diff`: Force a specific operation from the command line.

#### Process Limits

- **Windows Path Lengths**: Windows has a default path limit of 260 characters. If your backup source has very deep folder structures, ensure you enable "Long Paths" in Windows settings or keep target paths short.

#### Logging Options

- **Backup Report**: A `BACKUP_REPORT.txt` is always generated on your Desktop after each session, detailing the success, failures, and file changes.

### Search Engines Configuration

*(Repurposed for Target Destinations)*
- You can define multiple target paths for a single source by creating multiple sessions in `sessions.json` with the same `sourcePath` but different `targetPath` values.

### Search Keys Configuration

*(Repurposed for Source Directories)*
- Ensure your `sourcePath` in `sessions.json` points to the root directory you wish to back up. All subdirectories will be included unless excluded.

### Filter Configurations

#### Email Address Filters

*(Repurposed for Folder Exclusions)*
- Use the `excludeNames` array in `settings.ts` to skip entire directories by name.

#### Link Filters

*(Repurposed for File Pattern Exclusions)*
- Use the `excludePatterns` array in `settings.ts` to skip files matching specific patterns across all directories.

#### File Extension Filters

- You can skip specific file extensions by adding them to `excludePatterns`, for example: `['**/*.tmp', '**/*.bak']`.

### Email Domain Configurations

*(Repurposed for Cache Management)*
- The tool uses a `.cache` directory to speed up differential backups. If you experience issues with sync accuracy, you can use the "Clear Cache" option in the interactive menu.

## Running Scripts

### Main Crawler (with Monitor)

*(Repurposed for Interactive Menu)*
Starts the tool with an interactive menu to choose your backup mode:
```bash
npm start
```

### Backup

*(Repurposed for Automatic Differential Backup)*
Runs a differential backup automatically based on your `settings.ts` and `sessions.json`:
```bash
npm run sync
```

### Domain Counter

*(Repurposed for Cache Clearing)*
To clear the comparison cache manually:
1. Run `npm start`.
2. Select **Clear Cache** from the menu.

### Tests

#### Validate Single Email

*(Repurposed for Unit Testing)*
Runs the project's test suite to ensure everything is functioning correctly:
```bash
npm test
```

#### Validate Multiple Emails

Runs tests in watch mode for development:
```bash
npm run test:watch
```

#### Debug Email Validation

Opens the Vitest UI for a more detailed look at test results:
```bash
npm run test:ui
```

#### Test Typos

*(Reserved for future use)*

#### Test Link Crawling

*(Reserved for future use)*

#### Test Session Links

*(Reserved for future use)*

#### Email Generator Test

*(Reserved for future use)*

#### Test Cases

*(Reserved for future use)*

#### Sandbox

You can use `src/index.ts` as a starting point for any custom backup logic adjustments.

## Quick Start Guide

### For Testing (Development Mode)

1. Ensure your `sessions.json` points to a small test directory.
2. Run `npm start`.
3. Select **Full Backup** to see the initial copy process.
4. Modify a file in the source and run `npm start` again, selecting **Differential Backup**.

### For Production Crawling

*(Repurposed for Production Backups)*
1. Configure your real source and target paths in `sessions.json`.
2. Set `automaticMode: true` in `settings.ts`.
3. Set up a Windows Task Scheduler task to run `automatic-backup.bat` daily.
4. Check your Desktop for the `BACKUP_REPORT.txt` to verify success.

## File Structure

### Source Files (src/)

- `index.ts`: Main entry point and CLI orchestration.
- `sessions/sessions.json`: Your backup task definitions.
- `settings/settings.ts`: Global exclusion and mode settings.
- `diff-backup/`: Logic for comparing and syncing changes.
- `full-backup/`: Logic for complete directory replication.
- `utils/`: Common helpers for file operations and path resolving.

### Output Files (dist/)

- `BACKUP_REPORT.txt`: Found on your Desktop after execution.
- `.cache/`: Internal directory used for differential comparison state.

## Understanding the Console Status Line

When running, the tool displays a live progress line:
- **Time**: Time elapsed since the start of the current session.
- **Percentage**: Progress based on the total number of files to process.
- **Current Action**: Shows whether it is scanning, copying, or deleting a specific file.

## Troubleshooting

### Application Won't Start

- Ensure you have run `npm install`.
- Verify that your `sessions.json` and `settings.ts` have no syntax errors.
- Ensure you are using Node.js v18 or newer.

### No Email Addresses Being Found

*(Repurposed for Backup Issues)*
- Check if the `sourcePath` exists and contains files.
- Verify that your `excludeNames` or `excludePatterns` aren't skipping all your files.
- Check the `BACKUP_REPORT.txt` for specific error messages.

### Puppeteer Errors

*(Repurposed for File System Errors)*
- Ensure the target drive has enough free space.
- Verify that no files in the source or target are currently locked by another application.

### MongoDB Connection Errors

*(Repurposed for Path Errors)*
- Ensure all paths in `sessions.json` are absolute.
- On Windows, use double backslashes (`\\`) in JSON for paths.

### Application Keeps Restarting

- If running via a custom monitor, check the exit codes in the console.
- Ensure the `BACKUP_REPORT.txt` is not being blocked by another process.

## Important Notes

- **Full vs Diff**: Always run a **Full Backup** at least once for a new target to ensure a consistent baseline.
- **Exclusions**: Be careful with `excludePatterns`; a pattern like `*` will skip all files.
- **Automation**: When using Task Scheduler, ensure the task is set to "Start in" the project root directory.

## Author

- **Or Assayag** - [orassayag](https://github.com/orassayag)
- Or Assayag <orassayag@gmail.com>
