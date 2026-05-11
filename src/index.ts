import * as fs from 'fs';
import * as path from 'path';
import settings from './settings/settings';
import { validateSettings } from './validators/validators';
import { showMainMenu, showConfirmation, MenuChoice } from './menu/menu';
import { runFullBackup } from './full-backup/fullBackup';
import { runDiffBackup } from './diff-backup/diffBackup';
import { writeReport } from './reporter/reporter';
import { BackupResult } from './types/types';

export async function main(): Promise<void> {
  const startTime = new Date();
  let operation: MenuChoice = 'diff'; // Default
  let result: BackupResult;

  try {
    // 1. Validation
    validateSettings(settings);

    // Check for CLI arguments
    const args = process.argv.slice(2);
    const isAuto = args.includes('--auto');
    const opArg = args.find((arg) => arg.startsWith('--operation='));
    const forcedOp = opArg ? (opArg.split('=')[1] as MenuChoice) : null;

    // 2. Mode selection
    if (isAuto || settings.automaticMode) {
      operation = forcedOp || settings.automaticOperation;
    } else {
      operation = await showMainMenu();
    }

    if (operation === 'exit') {
      console.log('Exiting...');
      process.exit(0);
    }

    if (operation === 'clear-cache') {
      const cacheDir = path.join(process.cwd(), '.cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log('\n✅ Cache cleared successfully.');
      } else {
        console.log('\nℹ️ No cache found to clear.');
      }
      process.exit(0);
    }

    // 3. Confirmation (Skip if automatic)
    if (!isAuto && !settings.automaticMode) {
      const confirmed = await showConfirmation(
        settings,
        operation as 'full' | 'diff'
      );
      if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    }

    // 4. Execution
    if (operation === 'full') {
      result = await runFullBackup(settings);
    } else {
      result = await runDiffBackup(settings);
    }
  } catch (err: any) {
    // If it's a deliberate exit (like from process.exit mock in tests), re-throw it
    if (err.message === 'process.exit') throw err;

    // Create a failed result if anything crashed
    result = {
      operation: operation === 'full' ? 'full' : 'diff',
      startTime,
      endTime: new Date(),
      sessionResults: [
        {
          session: { sourcePath: 'N/A', targetPath: 'N/A' },
          status: 'failed',
          diffEntries: [],
          failedFiles: [],
          error: err.message || String(err),
        },
      ],
    };
    console.error('\n❌ Backup failed during execution:');
    console.error(err);
  }

  // 5. Reporting
  try {
    const reportPath = writeReport(result);
    console.log(`\n✅ Backup process finished.`);
    console.log(`📄 Report generated at: ${reportPath}`);
  } catch (reportErr: any) {
    console.error('\n❌ Failed to generate report:');
    console.error(reportErr);
  }
}

// Only run if this file is being executed directly (not imported in tests)
if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('\n❌ A critical error occurred in main loop:');
    console.error(err);
    process.exit(1);
  });
}
