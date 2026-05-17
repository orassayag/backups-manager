/**
 * settings.ts
 * Central configuration for backups-manager.
 * Edit this file to configure your backup source, targets, and exclusion patterns.
 */

export interface Settings {
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
  // ─── EXCLUSIONS ──────────────────────────────────────────────────────────────
  excludeNames: [
    'node_modules',
    '.git',
    'coverage',
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
