/**
 * reporter.ts
 * Writes BACKUP_REPORT.txt to the user's Desktop.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BackupResult, SessionResult } from '../types/index';
import {
  getDesktopPath,
  formatJerusalemTime,
  formatDuration,
  formatSize,
} from '../utils/index';

const REPORT_FILENAME = 'BACKUP_REPORT.txt';
const COL_PATH = 52;
const COL_SIZE = 11;
const COL_ACTION = 10;
const SEPARATOR = '='.repeat(COL_PATH + COL_SIZE + COL_ACTION + 4);

function truncatePath(p: string, maxLen: number): string {
  return p.length <= maxLen ? p : '...' + p.slice(p.length - (maxLen - 3));
}

function buildSessionReport(sessionResult: SessionResult): string {
  const lines: string[] = [];
  const { session, status, diffEntries, failedFiles, error } = sessionResult;

  lines.push('SESSION:');
  lines.push(`  Source: ${session.sourcePath}`);
  lines.push(`  Target: ${session.targetPath}`);
  lines.push(`Status: ${status.toUpperCase()}`);

  if (error) {
    lines.push(`Error: ${error}`);
  }

  if (status === 'skipped') {
    lines.push('');
    return lines.join('\n');
  }

  // Filter out internal cache files from the report
  const filteredDiffEntries = diffEntries.filter(
    (e) => !e.relativePath.includes('backup-cache.json')
  );
  const filteredFailedFiles = failedFiles.filter(
    (f) => !f.sourcePath.includes('backup-cache.json')
  );

  // ─── Failed files ────────────────────────────────────────────────────────
  if (filteredFailedFiles.length > 0) {
    lines.push(`⚠  FAILED FILES (${filteredFailedFiles.length}):`);
    lines.push('-'.repeat(60));
    filteredFailedFiles.forEach((f) => {
      lines.push(`  Source : ${f.sourcePath}`);
      lines.push(`  Target : ${f.targetPath}`);
      lines.push(`  Error  : ${f.error}`);
      lines.push('');
    });
  } else {
    lines.push('✓  No failed files.');
  }

  // ─── Diff table ──────────────────────────────────────────────────────────
  if (filteredDiffEntries.length > 0) {
    lines.push(`Changed files (${filteredDiffEntries.length}):`);
    lines.push('');
    lines.push(
      `${'File name'.padEnd(COL_PATH)}| ${'Size'.padEnd(COL_SIZE)}| Action`
    );
    lines.push(SEPARATOR);
    filteredDiffEntries.forEach((entry) => {
      const name = truncatePath(entry.relativePath, COL_PATH - 1).padEnd(
        COL_PATH
      );
      const sizeStr =
        entry.action === 'deleted' ? '--' : formatSize(entry.size);
      const size = sizeStr.padEnd(COL_SIZE);
      const action = entry.action.padEnd(COL_ACTION);
      lines.push(`${name}| ${size}| ${action}`);
    });
    lines.push(SEPARATOR);
    lines.push('');
    const added = filteredDiffEntries.filter(
      (e) => e.action === 'added'
    ).length;
    const updated = filteredDiffEntries.filter(
      (e) => e.action === 'updated'
    ).length;
    const deleted = filteredDiffEntries.filter(
      (e) => e.action === 'deleted'
    ).length;
    lines.push(
      `Summary: ${added} added, ${updated} updated, ${deleted} deleted.`
    );
  } else if (status !== 'failed') {
    lines.push('No differences found – everything is up to date.');
  }

  lines.push('');
  return lines.join('\n');
}

function buildBotSummary(result: BackupResult): string {
  const lines: string[] = [];
  lines.push('#FOR-BOT#');

  result.sessionResults.forEach((sessionResult) => {
    const { session, status, diffEntries } = sessionResult;
    const added = diffEntries.filter((e) => e.action === 'added').length;
    const updated = diffEntries.filter((e) => e.action === 'updated').length;
    const deleted = diffEntries.filter((e) => e.action === 'deleted').length;

    lines.push(`${session.sourcePath} -> ${session.targetPath}`);
    lines.push(`Status: ${status === 'success' ? 'SUCCESS' : 'FAILURE'}`);
    lines.push(`Summary: ${added} add | ${updated} update | ${deleted} delete`);
    lines.push('');
  });

  return lines.join('\n');
}

function buildReport(result: BackupResult): string {
  const lines: string[] = [];
  const dateStr = formatJerusalemTime(result.startTime);
  const duration = formatDuration(
    result.endTime.getTime() - result.startTime.getTime()
  );

  lines.push('BACKUP MANAGER REPORT');
  lines.push('');
  lines.push(`Date/Time  : ${dateStr}`);
  lines.push(
    `Operation  : ${result.operation === 'full' ? 'Full Backup' : 'Diff Backup'}`
  );
  lines.push(`Duration   : ${duration}`);
  lines.push('');
  lines.push('='.repeat(SEPARATOR.length));
  lines.push('');

  result.sessionResults.forEach((sessionResult) => {
    lines.push(buildSessionReport(sessionResult));
    lines.push('-'.repeat(SEPARATOR.length));
    lines.push('');
  });

  lines.push(buildBotSummary(result));

  return lines.join('\n');
}

export function writeReport(result: BackupResult): string {
  const desktopPath = getDesktopPath();
  const reportPath = path.resolve(path.join(desktopPath, REPORT_FILENAME));
  const content = buildReport(result);

  try {
    // Ensure the directory exists (though it should be the Desktop)
    if (!fs.existsSync(desktopPath)) {
      fs.mkdirSync(desktopPath, { recursive: true });
    }

    // Write the report, overriding any existing file
    fs.writeFileSync(reportPath, content, { encoding: 'utf8', flag: 'w' });
    return reportPath;
  } catch (err: any) {
    throw new Error(`Failed to write report to ${reportPath}: ${err.message}`);
  }
}
