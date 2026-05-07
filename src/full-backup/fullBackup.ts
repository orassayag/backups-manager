/**
 * fullBackup.ts
 * Performs a full backup of source → all targets with exclusions and progress.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/settings';
import { BackupResult, FailedFile } from '../types/types';
import { scanDirectory, resolvePath, copyFile } from '../utils/utils';
import { ProgressTracker } from '../progress/progress';

export async function runFullBackup(settings: Settings): Promise<BackupResult> {
  const startTime = new Date();
  const failedFiles: FailedFile[] = [];
  const sourcePath = resolvePath(settings.sourcePath);
  const targetPaths = settings.targetPaths.map(resolvePath);

  const progress = new ProgressTracker();
  progress.init(sourcePath);
  progress.start();
  progress.setScanning();

  // Scan source
  const sourceFiles = scanDirectory(
    sourcePath,
    settings.excludeNames,
    settings.excludePatterns
  );

  const totalOps = sourceFiles.length * targetPaths.length;
  progress.setTotalFiles(totalOps);

  // Copy to each target
  for (const targetRoot of targetPaths) {
    fs.mkdirSync(targetRoot, { recursive: true });

    for (const file of sourceFiles) {
      const targetFile = path.join(
        targetRoot,
        file.relativePath.replace(/\//g, path.sep)
      );
      progress.setCopying(file.absolutePath, targetFile, targetRoot);

      try {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        await copyFile(file.absolutePath, targetFile);

        // Preserve mtime so subsequent diff runs recognize the file as identical
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
  }

  progress.stop(failedFiles.length === 0);

  return {
    operation: 'full',
    startTime,
    endTime: new Date(),
    sourcePath,
    targetPaths,
    diffEntries: [],
    failedFiles,
  };
}
