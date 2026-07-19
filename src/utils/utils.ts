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
  const home = os.homedir() || '';

  if (process.platform === 'win32') {
    // 1. Try common environment variables
    const userProfile =
      process.env.USERPROFILE ||
      (process.env.HOMEDRIVE && process.env.HOMEPATH
        ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH)
        : '');

    if (userProfile) {
      const desktop = path.join(userProfile, 'Desktop');
      // In test environments, fs.existsSync might be mocked or return false.
      // We only skip if it explicitly exists.
      if (fs.existsSync && fs.existsSync(desktop)) return desktop;
    }

    // 2. Try os.homedir()
    if (home) {
      const homeDesktop = path.join(home, 'Desktop');
      if (fs.existsSync && fs.existsSync(homeDesktop)) return homeDesktop;

      // 3. Check for OneDrive Desktop
      const oneDriveDesktop = path.join(home, 'OneDrive', 'Desktop');
      if (fs.existsSync && fs.existsSync(oneDriveDesktop))
        return oneDriveDesktop;

      const oneDrivePersonalDesktop = path.join(
        home,
        'OneDrive - Personal',
        'Desktop'
      );
      if (fs.existsSync && fs.existsSync(oneDrivePersonalDesktop))
        return oneDrivePersonalDesktop;
    }

    // Fallback for win32 if nothing found/exists
    if (userProfile) return path.join(userProfile, 'Desktop');
  }

  // Fallback to ~/Desktop
  return path.join(home, 'Desktop');
}

// ─── EXCLUSION HELPERS ────────────────────────────────────────────────────────

/**
 * Returns true if the given entry should be excluded.
 * Uses micromatch for glob matching when available; falls back to simple string match.
 */
export function isExcluded(
  entryName: string,
  relPath: string,
  absEntry: string,
  globalExcludeNames: string[] = [],
  globalExcludePatterns: string[] = [],
  sessionExcludePaths?: string[],
  sessionExcludeNames?: string[],
  sessionExcludePatterns?: string[]
): boolean {
  // Check session exclude paths
  if (sessionExcludePaths) {
    for (const excludePath of sessionExcludePaths) {
      const normalizedExcludePath = normalizePath(path.resolve(excludePath));
      const normalizedAbsEntry = normalizePath(absEntry);
      if (normalizedAbsEntry.startsWith(normalizedExcludePath)) {
        return true;
      }
    }
  }

  // Combine global and session exclude names (case-insensitive)
  const allExcludeNames = [
    ...globalExcludeNames,
    ...(sessionExcludeNames || []),
  ];
  const entryNameLower = entryName.toLowerCase();
  if (allExcludeNames.some((name) => name.toLowerCase() === entryNameLower))
    return true;

  // Combine global and session exclude patterns
  const allExcludePatterns = [
    ...globalExcludePatterns,
    ...(sessionExcludePatterns || []),
  ];
  if (allExcludePatterns.length > 0) {
    if (micromatch.isMatch(relPath, allExcludePatterns)) return true;
    if (micromatch.isMatch(entryName, allExcludePatterns)) return true;
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
  if (bytes < 0) return '--';
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
 * Iteratively scan a directory and return all files, respecting exclusions.
 * Uses a stack to avoid RangeError on deep structures and detects symlink cycles.
 */
export function scanDirectory(
  rootDir: string,
  globalExcludeNames: string[],
  globalExcludePatterns: string[],
  sessionExcludePaths?: string[],
  sessionExcludeNames?: string[],
  sessionExcludePatterns?: string[]
): ScannedFile[] {
  const results: ScannedFile[] = [];
  const stack: { relDir: string; absDir: string }[] = [
    { relDir: '', absDir: rootDir },
  ];
  const visitedRealPaths = new Set<string>();

  while (stack.length > 0) {
    const { relDir, absDir } = stack.pop()!;

    // Resolve real path to detect cycles (especially with symlinks/junctions)
    let realPath: string;
    try {
      realPath = fs.realpathSync(absDir);
      if (visitedRealPaths.has(realPath)) continue;
      visitedRealPaths.add(realPath);
    } catch {
      // If we can't get realpath, just skip or proceed with caution?
      // Proceeding with caution (not adding to visited) might cause infinite loops if it's a cycle.
      // Skipping is safer.
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    if (entries.length === 0 && relDir) {
      // Empty directory
      results.push({
        relativePath: relDir,
        absolutePath: absDir,
        size: -1,
        mtime: 0,
      });
      continue;
    }

    let hasIncludedEntries = false;

    for (const entry of entries) {
      const relEntry = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absEntry = path.join(absDir, entry.name);
      if (
        isExcluded(
          entry.name,
          relEntry,
          absEntry,
          globalExcludeNames,
          globalExcludePatterns,
          sessionExcludePaths,
          sessionExcludeNames,
          sessionExcludePatterns
        )
      )
        continue;

      hasIncludedEntries = true;

      if (entry.isDirectory()) {
        stack.push({ relDir: relEntry, absDir: absEntry });
      } else if (entry.isSymbolicLink()) {
        // Check if the symlink points to a directory
        try {
          const stats = fs.statSync(absEntry);
          if (stats.isDirectory()) {
            stack.push({ relDir: relEntry, absDir: absEntry });
          } else if (stats.isFile()) {
            results.push({
              relativePath: relEntry,
              absolutePath: absEntry,
              size: stats.size,
              mtime: stats.mtimeMs,
            });
          }
        } catch {
          // Skip broken symlinks
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

    // If a directory was scanned but all its contents were excluded, track the directory itself
    if (!hasIncludedEntries && relDir) {
      results.push({
        relativePath: relDir,
        absolutePath: absDir,
        size: -1,
        mtime: 0,
      });
    }
  }

  return results;
}

/**
 * Promisified file copy using streams, preserves source file's atime and mtime.
 */
export function copyFile(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(src);
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
    wr.on('close', () => {
      // Preserve the original file times (atime and mtime)
      fs.utimesSync(dest, new Date(stat.atimeMs), new Date(stat.mtimeMs));
      resolve();
    });
    rd.pipe(wr);
  });
}
