/**
 * settings.ts
 * Central configuration for backups-manager.
 * Edit this file to configure your backup source, targets, and exclusion patterns.
 */

export interface Settings {
  /** The root source directory to backup (all sub-directories included recursively). */
  sourcePath: string;
  /** Array of target/destination paths. At least one is required. */
  targetPaths: string[];
  /** Exact folder/file names to exclude during comparison and backup. */
  excludeNames: string[];
  /**
   * Glob-style patterns to exclude (matched against relative paths).
   */
  excludePatterns: string[];
  /** Whether running in automatic mode (e.g. Windows Task Scheduler). Skips interactive menu. */
  automaticMode: boolean;
  /** In automatic mode, which operation to perform: 'full' or 'diff'. */
  automaticOperation: 'full' | 'diff';
}

const settings: Settings = {
  // ─── SOURCE ──────────────────────────────────────────────────────────────────
  sourcePath: 'C:\\Users\\Or Assayag\\Desktop\\job-interviews-backup1',

  // ─── TARGETS ─────────────────────────────────────────────────────────────────
  targetPaths: ['E:\\job-interviews-backup2'],

  // ─── EXCLUSIONS ──────────────────────────────────────────────────────────────
  excludeNames: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.DS_Store',
    'Thumbs.db',
  ],

  excludePatterns: ['**/backup-results.json'],

  // ─── AUTOMATIC MODE ──────────────────────────────────────────────────────────
  automaticMode: false,
  automaticOperation: 'diff',
};

export default settings;
