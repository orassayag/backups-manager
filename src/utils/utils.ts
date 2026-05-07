/**
 * utils.ts
 * Shared utility helpers for backups-manager.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import micromatch from 'micromatch';

// ─── PATH HELPERS ─────────────────────────────────────────────────────────────

/** Normalize path to forward slashes on all platforms. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Resolve and normalize a path. */
export function resolvePath(p: string): string {
  return normalizePath(path.resolve(p));
}

/** Return the OS Desktop path (Windows / macOS / Linux). */
export function getDesktopPath(): string {
  if (process.platform === 'win32') {
    const userProfile =
      process.env.USERPROFILE ||
      (process.env.HOMEDRIVE ?? '') + (process.env.HOMEPATH ?? '');
    if (userProfile) return path.join(userProfile, 'Desktop');
  }
  return path.join(os.homedir(), 'Desktop');
}

// ─── EXCLUSION HELPERS ────────────────────────────────────────────────────────

/**
 * Returns true if the given entry should be excluded.
 * Uses micromatch for glob matching when available; falls back to simple string match.
 */
export function isExcluded(
  entryName: string,
  relPath: string,
  excludeNames: string[],
  excludePatterns: string[]
): boolean {
  if (excludeNames.includes(entryName)) return true;
  if (excludePatterns.length > 0) {
    if (micromatch.isMatch(relPath, excludePatterns)) return true;
    if (micromatch.isMatch(entryName, excludePatterns)) return true;
  }
  return false;
}

// ─── TIME FORMATTING ─────────────────────────────────────────────────────────

/** Format elapsed seconds as "HH:MM:SS". */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/** Format a duration in ms as "4h 22m 13s". */
export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/** Format a Date to Jerusalem local time as "dd/MM/yyyy HH:mm:ss". */
export function formatJerusalemTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// ─── SIZE FORMATTING ─────────────────────────────────────────────────────────

/** Format bytes into a human-readable size string. */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ─── FILE SCANNING ───────────────────────────────────────────────────────────

export interface ScannedFile {
  relativePath: string; // forward-slash relative path
  absolutePath: string;
  size: number;
  mtime: number;
}

/**
 * Recursively scan a directory and return all files, respecting exclusions.
 */
export function scanDirectory(
  rootDir: string,
  excludeNames: string[],
  excludePatterns: string[],
  currentRel: string = ''
): ScannedFile[] {
  const results: ScannedFile[] = [];
  const absDir = path.join(rootDir, currentRel);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const relEntry = currentRel ? `${currentRel}/${entry.name}` : entry.name;
    if (isExcluded(entry.name, relEntry, excludeNames, excludePatterns))
      continue;

    const absEntry = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = scanDirectory(
        rootDir,
        excludeNames,
        excludePatterns,
        relEntry
      );
      if (subFiles.length > 0) {
        results.push(...subFiles);
      } else {
        // If directory is empty (or all its contents are excluded), still track the directory itself
        // so we can identify it for deletion if needed.
        // We'll use a special size of -1 to indicate a directory.
        results.push({
          relativePath: relEntry,
          absolutePath: absEntry,
          size: -1,
          mtime: 0,
        });
      }
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(absEntry);
        results.push({
          relativePath: relEntry,
          absolutePath: absEntry,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      } catch {
        // skip unreadable files
      }
    }
  }
  return results;
}

/**
 * Promisified file copy using streams.
 */
export function copyFile(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rd = fs.createReadStream(src);
    const wr = fs.createWriteStream(dest);
    rd.on('error', (err) => {
      wr.destroy();
      reject(err);
    });
    wr.on('error', (err) => {
      wr.destroy();
      reject(err);
    });
    wr.on('close', resolve);
    rd.pipe(wr);
  });
}
