/**
 * validator.ts
 * Validates global settings before any backup operation begins.
 */

import { Settings } from '../settings/settings';

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

  // ─── Report & exit ────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.error('\n❌  Validation errors found in settings.ts:\n');
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    console.error('\nPlease fix the above errors and try again.\n');
    process.exit(1);
  }
}
