/**
 * types.ts
 * Shared TypeScript interfaces and types used throughout backups-manager.
 */

export type DiffAction = 'added' | 'updated' | 'deleted';

export interface DiffEntry {
  relativePath: string;
  size: number;
  action: DiffAction;
}

export interface FailedFile {
  sourcePath: string;
  targetPath: string;
  error: string;
}

export interface BackupResult {
  operation: 'full' | 'diff';
  startTime: Date;
  endTime: Date;
  sourcePath: string;
  targetPaths: string[];
  /** Populated for diff backup only */
  diffEntries: DiffEntry[];
  failedFiles: FailedFile[];
}
