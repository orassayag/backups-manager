/**
 * validator.ts
 * Validates global settings before any backup operation begins.
 */

import { Settings } from '../settings/index';

export function validateSettings(settings: Settings): void {
  const errors: string[] = [];

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

  // ─── Report & throw ────────────────────────────────────────────────────────
  if (errors.length > 0) {
    const errorMsg =
      'Validation errors found in settings.ts:\n' +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
    throw new Error(errorMsg);
  }
}
