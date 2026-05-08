/**
 * fullBackup.ts
 * Performs a full backup of sessions with exclusions and progress.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/settings';
import {
  BackupResult,
  FailedFile,
  Session,
  SessionResult,
} from '../types/types';
import { scanDirectory, resolvePath, copyFile } from '../utils/utils';
import { ProgressTracker } from '../progress/progress';

/**
 * Processes a single session for full backup.
 */
async function processSession(
  session: Session,
  settings: Settings,
  progress: ProgressTracker
): Promise<SessionResult> {
  const failedFiles: FailedFile[] = [];
  const sourcePath = resolvePath(session.sourcePath);
  const targetPath = resolvePath(session.targetPath);

  // 1. Validation
  if (!session.sourcePath || !session.targetPath) {
    return {
      session,
      status: 'skipped',
      diffEntries: [],
      failedFiles: [],
      error: 'Source or target path is missing or empty',
    };
  }

  if (!fs.existsSync(sourcePath)) {
    return {
      session,
      status: 'skipped',
      diffEntries: [],
      failedFiles: [],
      error: `Source path does not exist: ${sourcePath}`,
    };
  }

  progress.init(sourcePath);
  progress.start();
  progress.setScanning();

  // Scan source
  const sourceFiles = scanDirectory(
    sourcePath,
    settings.excludeNames,
    settings.excludePatterns
  );

  progress.setTotalFiles(sourceFiles.length);

  fs.mkdirSync(targetPath, { recursive: true });

  for (const file of sourceFiles) {
    if (file.size === -1) {
      // It's a directory
      const targetDir = path.join(
        targetPath,
        file.relativePath.replace(/\//g, path.sep)
      );
      fs.mkdirSync(targetDir, { recursive: true });
      progress.fileComplete();
      continue;
    }

    const targetFile = path.join(
      targetPath,
      file.relativePath.replace(/\//g, path.sep)
    );
    progress.setCopying(file.absolutePath, targetFile, targetPath);

    try {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      await copyFile(file.absolutePath, targetFile);

      // Preserve mtime
      const sourceStat = fs.statSync(file.absolutePath);
      fs.utimesSync(targetFile, sourceStat.atime, sourceStat.mtime);
    } catch (err: unknown) {
      failedFiles.push({
        sourcePath: file.absolutePath,
        targetPath: targetFile,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    progress.fileComplete();
  }

  progress.stop(failedFiles.length === 0);

  return {
    session,
    status: failedFiles.length > 0 ? 'failed' : 'success',
    diffEntries: [], // Not applicable for full backup
    failedFiles,
  };
}

export async function runFullBackup(settings: Settings): Promise<BackupResult> {
  const startTime = new Date();
  const sessionResults: SessionResult[] = [];

  const sessionsPath = path.join(
    process.cwd(),
    'src',
    'sessions',
    'sessions.json'
  );

  // 1. Check for sessions file
  if (!fs.existsSync(sessionsPath)) {
    throw new Error(`Sessions file not found at ${sessionsPath}`);
  }

  let sessions: Session[] = [];
  try {
    const sessionsContent = fs.readFileSync(sessionsPath, 'utf8');
    sessions = JSON.parse(sessionsContent);
  } catch (err: any) {
    throw new Error(`Error reading sessions.json: ${err.message}`);
  }

  if (!sessions || sessions.length === 0) {
    throw new Error('No sessions found in sessions.json');
  }

  const progress = new ProgressTracker();

  // 2. Process each session
  for (const session of sessions) {
    const result = await processSession(session, settings, progress);
    sessionResults.push(result);
  }

  return {
    operation: 'full',
    startTime,
    endTime: new Date(),
    sessionResults,
  };
}
