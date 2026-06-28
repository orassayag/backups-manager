import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/index';
import {
  BackupResult,
  DiffEntry,
  FailedFile,
  Session,
  SessionResult,
} from '../types/index';
import {
  scanDirectory,
  resolvePath,
  ScannedFile,
  copyFile,
} from '../utils/index';
import { ProgressTracker } from '../progress/index';
import { logger } from '../logging/index';

const CACHE_DIR = path.join(process.cwd(), '.cache');

interface CacheData {
  [relativePath: string]: { size: number; mtime: number };
}

/**
 * Processes a single session for diff backup.
 */
async function processSession(
  session: Session,
  settings: Settings,
  progress: ProgressTracker
): Promise<SessionResult> {
  logger.debug('Processing session (Diff)', { session });
  const failedFiles: FailedFile[] = [];
  const diffEntries: DiffEntry[] = [];

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

  // 2. Load Cache (using a unique key for each session if possible, but keeping current behavior for now)
  // For simplicity and to match user request, I'll use the same cache file.
  // However, to avoid conflicts between sessions, let's use a session-specific cache name.
  const sessionHash = Buffer.from(`${sourcePath}:${targetPath}`).toString(
    'hex'
  );
  const sessionCachePath = path.join(CACHE_DIR, `cache-${sessionHash}.json`);

  let cache: CacheData = {};
  if (fs.existsSync(sessionCachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(sessionCachePath, 'utf8'));
    } catch {
      cache = {};
    }
  }

  progress.init(sourcePath);
  progress.start();
  progress.setScanning();

  // 3. Scan Source
  const currentFiles = scanDirectory(
    sourcePath,
    settings.excludeNames,
    settings.excludePatterns
  );
  const currentFilesMap = new Map<string, ScannedFile>();

  // Identify Adds and Updates
  for (const file of currentFiles) {
    if (file.size === -1) continue;

    currentFilesMap.set(file.relativePath, file);

    const targetFilePath = path.join(
      targetPath,
      file.relativePath.replace(/\//g, path.sep)
    );

    let identical = false;
    if (fs.existsSync(targetFilePath)) {
      try {
        const targetStat = fs.statSync(targetFilePath);
        const sizeMatch = targetStat.size === file.size;
        const mtimeMatch = Math.abs(targetStat.mtimeMs - file.mtime) < 1000;
        if (sizeMatch && mtimeMatch) {
          identical = true;
        }
      } catch {
        // ignore
      }
    }

    if (!identical) {
      diffEntries.push({
        relativePath: file.relativePath,
        size: file.size,
        action: fs.existsSync(targetFilePath) ? 'updated' : 'added',
      });
    }
  }

  // Identify Deletions
  for (const relPath in cache) {
    if (!currentFilesMap.has(relPath)) {
      diffEntries.push({
        relativePath: relPath,
        size: cache[relPath].size,
        action: 'deleted',
      });
    }
  }

  // Scan Target for Orphans
  if (fs.existsSync(targetPath)) {
    const targetFiles = scanDirectory(
      targetPath,
      settings.excludeNames,
      settings.excludePatterns
    );
    for (const tFile of targetFiles) {
      if (!currentFilesMap.has(tFile.relativePath)) {
        const alreadyInDiff = diffEntries.find(
          (e) => e.relativePath === tFile.relativePath && e.action === 'deleted'
        );
        if (!alreadyInDiff) {
          diffEntries.push({
            relativePath: tFile.relativePath,
            size: tFile.size,
            action: 'deleted',
          });
        }
      }
    }
  }

  progress.setTotalFiles(diffEntries.length);

  // 4. Execute Operations
  for (const entry of diffEntries) {
    const targetFilePath = path.join(
      targetPath,
      entry.relativePath.replace(/\//g, path.sep)
    );

    try {
      if (entry.action === 'deleted') {
        if (fs.existsSync(targetFilePath)) {
          const stat = fs.statSync(targetFilePath);
          if (stat.isDirectory()) {
            fs.rmSync(targetFilePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(targetFilePath);
          }
        }
      } else {
        const sourceFile = currentFilesMap.get(entry.relativePath)!;
        progress.setCopying(
          sourceFile.absolutePath,
          targetFilePath,
          targetPath
        );
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        await copyFile(sourceFile.absolutePath, targetFilePath);
        const sourceStat = fs.statSync(sourceFile.absolutePath);
        fs.utimesSync(targetFilePath, sourceStat.atime, sourceStat.mtime);
      }
    } catch (err: any) {
      failedFiles.push({
        sourcePath: entry.relativePath,
        targetPath: targetFilePath,
        error: err.message,
      });
    }
    progress.fileComplete();
  }

  // 5. Update Cache
  const newCache: CacheData = {};
  currentFiles.forEach((f) => {
    if (f.size !== -1) {
      newCache[f.relativePath] = { size: f.size, mtime: f.mtime };
    }
  });
  fs.writeFileSync(sessionCachePath, JSON.stringify(newCache, null, 2));

  progress.stop(failedFiles.length === 0);

  return {
    session,
    status: failedFiles.length > 0 ? 'failed' : 'success',
    diffEntries,
    failedFiles,
  };
}

export async function runDiffBackup(settings: Settings): Promise<BackupResult> {
  logger.info('Running Differential Backup');
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

  if (!fs.existsSync(CACHE_DIR)) {
    logger.debug('Creating cache directory', { CACHE_DIR });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const progress = new ProgressTracker();

  // 2. Process each session
  for (const session of sessions) {
    const result = await processSession(session, settings, progress);
    sessionResults.push(result);
  }

  return {
    operation: 'diff',
    startTime,
    endTime: new Date(),
    sessionResults,
  };
}
