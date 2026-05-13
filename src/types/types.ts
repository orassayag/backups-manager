/**
 * types.ts
 * Shared TypeScript interfaces and types used throughout backups-manager.
 */

type DiffAction = 'added' | 'updated' | 'deleted';

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

export interface Session {
  sourcePath: string;
  targetPath: string;
}

export interface SessionResult {
  session: Session;
  status: 'success' | 'skipped' | 'failed';
  diffEntries: DiffEntry[];
  failedFiles: FailedFile[];
  error?: string;
}

export interface BackupResult {
  operation: 'full' | 'diff';
  startTime: Date;
  endTime: Date;
  sessionResults: SessionResult[];
}
