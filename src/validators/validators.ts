/**
 * validator.ts
 * Validates all settings before any backup operation begins.
 * Exits with a clear error message if anything is misconfigured.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/settings';
import { resolvePath } from '../utils/utils';

export function validateSettings(settings: Settings): void {
  const errors: string[] = [];

  // ─── Source path ──────────────────────────────────────────────────────────
  if (!settings.sourcePath || settings.sourcePath.trim() === '') {
    errors.push('sourcePath is required but is empty.');
  } else {
    const resolved = resolvePath(settings.sourcePath);
    if (!fs.existsSync(resolved)) {
      errors.push(`sourcePath does not exist: "${resolved}"`);
    } else if (!fs.statSync(resolved).isDirectory()) {
      errors.push(`sourcePath is not a directory: "${resolved}"`);
    }
  }

  // ─── Target paths ─────────────────────────────────────────────────────────
  if (!settings.targetPaths || settings.targetPaths.length === 0) {
    errors.push('targetPaths must contain at least one path.');
  } else {
    settings.targetPaths.forEach((tp, i) => {
      if (!tp || tp.trim() === '') {
        errors.push(`targetPaths[${i}] is empty.`);
        return;
      }
      const resolved = resolvePath(tp);
      const root = path.parse(resolved).root;
      if (root && !fs.existsSync(root)) {
        errors.push(
          `targetPaths[${i}] root drive/mount does not exist: "${root}"`
        );
      }
    });
  }

  // ─── Array fields ─────────────────────────────────────────────────────────
  if (!Array.isArray(settings.excludeNames)) {
    errors.push('excludeNames must be an array.');
  }
  if (!Array.isArray(settings.excludePatterns)) {
    errors.push('excludePatterns must be an array.');
  }

  // ─── Automatic mode ───────────────────────────────────────────────────────
  if (settings.automaticMode) {
    if (
      settings.automaticOperation !== 'full' &&
      settings.automaticOperation !== 'diff'
    ) {
      errors.push(
        'automaticOperation must be "full" or "diff" when automaticMode is true.'
      );
    }
  }

  // ─── Report & exit ────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.error('\n❌  Validation errors found in settings.ts:\n');
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    console.error('\nPlease fix the above errors and try again.\n');
    process.exit(1);
  }
}
