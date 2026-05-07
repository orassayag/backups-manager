/**
 * reporter.ts
 * Writes BACKUP_REPORT.txt to the user's Desktop.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BackupResult } from '../types/types';
import {
  getDesktopPath,
  formatJerusalemTime,
  formatDuration,
  formatSize,
} from '../utils/utils';

const REPORT_FILENAME = 'BACKUP_REPORT.txt';
const COL_PATH = 52;
const COL_SIZE = 11;
const COL_ACTION = 10;
const SEPARATOR = '='.repeat(COL_PATH + COL_SIZE + COL_ACTION + 4);

function truncatePath(p: string, maxLen: number): string {
  return p.length <= maxLen ? p : '...' + p.slice(p.length - (maxLen - 3));
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
  lines.push(`Source     : ${result.sourcePath}`);
  lines.push('');
  lines.push('Targets:');
  result.targetPaths.forEach((t) => lines.push(`  ${t}`));
  lines.push('');

  // ─── Failed files ────────────────────────────────────────────────────────
  if (result.failedFiles.length > 0) {
    lines.push(`⚠  FAILED FILES (${result.failedFiles.length}):`);
    lines.push('-'.repeat(60));
    result.failedFiles.forEach((f) => {
      lines.push(`  Source : ${f.sourcePath}`);
      lines.push(`  Target : ${f.targetPath}`);
      lines.push(`  Error  : ${f.error}`);
      lines.push('');
    });
  } else {
    lines.push('✓  No failed files.');
    lines.push('');
  }

  // ─── Diff table ──────────────────────────────────────────────────────────
  if (result.operation === 'diff') {
    if (result.diffEntries.length > 0) {
      lines.push(`Changed files (${result.diffEntries.length}):`);
      lines.push('');
      lines.push(
        `${'File name'.padEnd(COL_PATH)}| ${'Size'.padEnd(COL_SIZE)}| Action`
      );
      lines.push(SEPARATOR);
      result.diffEntries.forEach((entry) => {
        const name = truncatePath(entry.relativePath, COL_PATH - 1).padEnd(
          COL_PATH
        );
        const size = formatSize(entry.size).padEnd(COL_SIZE);
        const action = entry.action.padEnd(COL_ACTION);
        lines.push(`${name}| ${size}| ${action}`);
      });
      lines.push(SEPARATOR);
      lines.push('');
      const added = result.diffEntries.filter(
        (e) => e.action === 'added'
      ).length;
      const updated = result.diffEntries.filter(
        (e) => e.action === 'updated'
      ).length;
      const deleted = result.diffEntries.filter(
        (e) => e.action === 'deleted'
      ).length;
      lines.push(
        `Summary: ${added} added, ${updated} updated, ${deleted} deleted.`
      );
    } else {
      lines.push('No differences found – everything is up to date.');
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function writeReport(result: BackupResult): string {
  const desktopPath = getDesktopPath();
  const reportPath = path.join(desktopPath, REPORT_FILENAME);
  const content = buildReport(result);
  fs.writeFileSync(reportPath, content, 'utf8');
  return reportPath;
}
