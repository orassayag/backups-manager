/**
 * fullBackup.ts
 * Performs a full backup of sessions with exclusions and progress.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/index';
import {
  BackupResult,
  FailedFile,
  Session,
  SessionResult,
} from '../types/index';
import { scanDirectory, resolvePath, copyFile } from '../utils/index';
import { ProgressTracker } from '../progress/index';
import { logger } from '../logging/index';

/**
 * Processes a single session for full backup.
 */
async function processSession(
  session: Session,
  settings: Settings,
  progress: ProgressTracker
): Promise<SessionResult> {
  logger.debug('Processing session (Full)', { session });
  const failedFiles: FailedFile[] = [];
  const sourcePath = resolvePath(session.sourcePath);
  const targetPath = resolvePath(session.targetPath);

  // 1. Validation
  if (!session.sourcePath || !session.targetPath) {
    logger.warn('Skipping session: Source or target path missing');
    return {
      session,
      status: 'skipped',
      diffEntries: [],
      failedFiles: [],
      error: 'Source or target path is missing or empty',
    };
  }

  if (!fs.existsSync(sourcePath)) {
    logger.warn('Skipping session: Source path does not exist', { sourcePath });
    return {
      session,
      status: 'skipped',
      diffEntries: [],
      failedFiles: [],
      error: `Source path does not exist: ${sourcePath}`,
    };
  }

  // Check if target path parent is accessible
  const targetParent = path.dirname(targetPath);
  try {
    if (!fs.existsSync(targetParent)) {
      fs.mkdirSync(targetParent, { recursive: true });
    }
    // Test if we can write to target path by creating a temporary file
    const testFile = path.join(targetParent, `.backup-test-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err: unknown) {
    logger.warn('Skipping session: Target path not accessible', {
      targetPath,
      error: err,
    });
    return {
      session,
      status: 'skipped',
      diffEntries: [],
      failedFiles: [],
      error: `Target path not accessible: ${targetPath} - ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  progress.init(sourcePath);
  progress.start();
  progress.setScanning();

  // Scan source
  const sourceFiles = scanDirectory(
    sourcePath,
    settings.excludeNames,
    settings.excludePatterns,
    session.excludePaths,
    session.excludeNames,
    session.excludePatterns
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
  logger.info('Running Full Backup');
  const startTime = new Date();
  const sessionResults: SessionResult[] = [];

  const sessionsPath = path.join(
    process.cwd(),
    'src',
    'sessions',
    'sessions.json'
  );

  // 1. Check for sessions file
  logger.debug('Loading sessions', { sessionsPath });
  if (!fs.existsSync(sessionsPath)) {
    logger.error('Sessions file not found', undefined, { sessionsPath });
    throw new Error(`Sessions file not found at ${sessionsPath}`);
  }

  let sessions: Session[] = [];
  try {
    const sessionsContent = fs.readFileSync(sessionsPath, 'utf8');
    const parsed = JSON.parse(sessionsContent);
    sessions = Array.isArray(parsed) ? parsed : [];
    logger.debug('Sessions loaded', { count: sessions.length });
  } catch (err: any) {
    logger.error('Error reading sessions.json', err);
    throw new Error(`Error reading sessions.json: ${err.message}`);
  }

  if (!sessions || sessions.length === 0) {
    logger.warn('No sessions found in sessions.json');
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
