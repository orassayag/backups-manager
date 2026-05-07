import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/settings';
import { BackupResult, DiffEntry, FailedFile } from '../types/types';
import {
  scanDirectory,
  resolvePath,
  ScannedFile,
  copyFile,
} from '../utils/utils';
import { ProgressTracker } from '../progress/progress';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILENAME = 'backup-cache.json';

interface CacheData {
  [relativePath: string]: { size: number; mtime: number };
}

export async function runDiffBackup(settings: Settings): Promise<BackupResult> {
  const startTime = new Date();
  const failedFiles: FailedFile[] = [];
  const diffEntries: DiffEntry[] = [];

  const sourcePath = resolvePath(settings.sourcePath);
  const targetPaths = settings.targetPaths.map(resolvePath);

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cachePath = path.join(CACHE_DIR, CACHE_FILENAME);

  const progress = new ProgressTracker();
  progress.init(sourcePath);
  progress.start();
  progress.setScanning();

  // 1. Load Cache
  let cache: CacheData = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      cache = {};
    }
  } else {
    progress.setCreatingCache();
  }

  // 2. Scan Source
  const currentFiles = scanDirectory(
    sourcePath,
    settings.excludeNames,
    settings.excludePatterns
  );
  const currentFilesMap = new Map<string, ScannedFile>();

  // Identify Adds and Updates
  for (const file of currentFiles) {
    if (file.size === -1) continue; // Skip directory entries for copy/update logic

    currentFilesMap.set(file.relativePath, file);

    // Check if the file exists and is identical in ALL targets
    let allTargetsIdentical = true;
    for (const targetRoot of targetPaths) {
      const targetFilePath = path.join(
        targetRoot,
        file.relativePath.replace(/\//g, path.sep)
      );

      if (!fs.existsSync(targetFilePath)) {
        allTargetsIdentical = false;
        break;
      }

      try {
        const targetStat = fs.statSync(targetFilePath);
        // Compare size and mtime (allow 1s difference due to filesystem precision)
        const sizeMatch = targetStat.size === file.size;
        const mtimeMatch = Math.abs(targetStat.mtimeMs - file.mtime) < 1000;

        if (!sizeMatch || !mtimeMatch) {
          allTargetsIdentical = false;
          break;
        }
      } catch {
        allTargetsIdentical = false;
        break;
      }
    }

    if (allTargetsIdentical) {
      // File is already identical in all targets, skip it
      continue;
    }

    // Determine if it's an "addition" or "update" based on target existence
    let existsOnAnyTarget = false;
    for (const targetRoot of targetPaths) {
      const targetFilePath = path.join(
        targetRoot,
        file.relativePath.replace(/\//g, path.sep)
      );
      if (fs.existsSync(targetFilePath)) {
        existsOnAnyTarget = true;
        break;
      }
    }

    diffEntries.push({
      relativePath: file.relativePath,
      size: file.size,
      action: existsOnAnyTarget ? 'updated' : 'added',
    });
  }

  // Identify Deletions (Files in cache but no longer in source)
  for (const relPath in cache) {
    if (!currentFilesMap.has(relPath)) {
      diffEntries.push({
        relativePath: relPath,
        size: cache[relPath].size,
        action: 'deleted',
      });
    }
  }

  // 3. Scan Targets for Orphan Files/Folders (Not in source and not in cache)
  for (const targetRoot of targetPaths) {
    if (!fs.existsSync(targetRoot)) continue;

    const targetFiles = scanDirectory(
      targetRoot,
      settings.excludeNames,
      settings.excludePatterns
    );

    for (const tFile of targetFiles) {
      if (!currentFilesMap.has(tFile.relativePath)) {
        // If it's not in the source, it should be deleted from this target
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

  const filesToCopy = diffEntries.filter((e) => e.action !== 'deleted');
  const totalOps =
    filesToCopy.length * targetPaths.length +
    (diffEntries.length - filesToCopy.length) * targetPaths.length;
  progress.setTotalFiles(totalOps);

  // 3. Execute Operations across all targets
  for (const targetRoot of targetPaths) {
    for (const entry of diffEntries) {
      const targetFilePath = path.join(
        targetRoot,
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

          // Per-target check: Skip if this specific target is already up to date
          if (fs.existsSync(targetFilePath)) {
            try {
              const targetStat = fs.statSync(targetFilePath);
              const sizeMatch = targetStat.size === sourceFile.size;
              const mtimeMatch =
                Math.abs(targetStat.mtimeMs - sourceFile.mtime) < 1000;

              if (sizeMatch && mtimeMatch) {
                progress.fileComplete();
                continue;
              }
            } catch {
              // If stat fails, proceed with copy
            }
          }

          progress.setCopying(
            sourceFile.absolutePath,
            targetFilePath,
            targetRoot
          );

          fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
          await copyFile(sourceFile.absolutePath, targetFilePath);

          // Preserve mtime so subsequent runs recognize the file as identical
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
  }

  // 4. Update Cache (Only with successfully scanned/processed files)
  const newCache: CacheData = {};
  currentFiles.forEach((f) => {
    if (f.size !== -1) {
      newCache[f.relativePath] = { size: f.size, mtime: f.mtime };
    }
  });
  fs.writeFileSync(cachePath, JSON.stringify(newCache, null, 2));

  progress.stop(failedFiles.length === 0);

  return {
    operation: 'diff',
    startTime,
    endTime: new Date(),
    sourcePath,
    targetPaths,
    diffEntries,
    failedFiles,
  };
}
