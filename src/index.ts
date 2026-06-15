import * as fs from 'fs';
import * as path from 'path';
import settings from './settings/index';
import { validateSettings } from './validators/index';
import { showMainMenu, showConfirmation, MenuChoice } from './menu/index';
import { runFullBackup } from './full-backup/index';
import { runDiffBackup } from './diff-backup/index';
import { writeReport } from './reporter/index';
import { BackupResult } from './types/index';
import { logger } from './logging/index';

// Global signal handler for clean exit on Ctrl+C
process.on('SIGINT', () => {
  logger.info('Received SIGINT, exiting...');
  console.log('\nExiting...');
  process.exit(0);
});

// Safety net for readline-related errors that occur during exit
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ERR_USE_AFTER_CLOSE') {
    logger.debug('Ignoring ERR_USE_AFTER_CLOSE during exit');
    process.exit(0);
  }
  logger.error('Uncaught Exception', err);
  console.error('\n❌ Uncaught Exception:', err);
  process.exit(1);
});

export async function main(): Promise<void> {
  logger.info('Application started', {
    cwd: process.cwd(),
    argv: process.argv,
    nodeVersion: process.version,
  });

  const startTime = new Date();
  let operation: MenuChoice = 'diff'; // Default
  let result: BackupResult;

  try {
    // 1. Validation
    logger.debug('Validating settings');
    validateSettings(settings);

    // Check for CLI arguments
    const args = process.argv.slice(2);
    const isAuto = args.includes('--auto');
    const opArg = args.find((arg) => arg.startsWith('--operation='));
    const forcedOp = opArg ? (opArg.split('=')[1] as MenuChoice) : null;

    logger.debug('Mode selection', {
      isAuto,
      forcedOp,
      settingsAuto: settings.automaticMode,
    });

    // 2. Mode selection
    if (isAuto || settings.automaticMode) {
      operation = forcedOp || settings.automaticOperation;
      logger.info('Running in automatic mode', { operation });
    } else {
      logger.debug('Showing main menu');
      operation = await showMainMenu();
      logger.info('Menu selection', { operation });
    }

    if (operation === 'exit') {
      logger.info('User selected exit');
      console.log('Exiting...');
      process.exit(0);
    }

    if (operation === 'clear-cache') {
      logger.info('User selected clear-cache');
      const cacheDir = path.join(process.cwd(), '.cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        logger.info('Cache cleared successfully');
        console.log('\n✅ Cache cleared successfully.');
      } else {
        logger.info('No cache found to clear');
        console.log('\nℹ️ No cache found to clear.');
      }
      process.exit(0);
    }

    // 3. Confirmation (Skip if automatic)
    if (!isAuto && !settings.automaticMode) {
      logger.debug('Showing confirmation prompt');
      const confirmed = await showConfirmation(
        settings,
        operation as 'full' | 'diff'
      );
      logger.info('Confirmation result', { confirmed });
      if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    }

    // 4. Execution
    logger.info('Starting backup execution', { operation });
    if (operation === 'full') {
      result = await runFullBackup(settings);
    } else {
      result = await runDiffBackup(settings);
    }
    logger.info('Backup execution finished', {
      status: result.sessionResults.every((r) => r.status === 'success')
        ? 'success'
        : 'partial/failed',
    });
  } catch (err: any) {
    logger.error('Error in main execution', err);
    // If it's a deliberate exit (like from process.exit mock in tests), re-throw it
    if (err.message === 'process.exit') throw err;

    // Handle prompt cancellation gracefully
    if (
      err.name === 'ExitPromptError' ||
      err.message?.includes('force closed') ||
      err.code === 'ERR_USE_AFTER_CLOSE' ||
      err === ''
    ) {
      logger.info('Prompt force closed or cancelled');
      console.log('\nExiting...');
      process.exit(0);
    }

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
    logger.debug('Generating report');
    const reportPath = writeReport(result);
    logger.info('Report generated', { reportPath });
    console.log(`\n✅ Backup process finished.`);
    console.log(`📄 Report generated at: ${reportPath}`);
  } catch (reportErr: any) {
    logger.error('Failed to generate report', reportErr);
    console.error('\n❌ Failed to generate report:');
    console.error(reportErr);
  }
}

// Only run if this file is being executed directly (not imported in tests)
if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    logger.error('Critical error in main loop', err);
    console.error('\n❌ A critical error occurred in main loop:');
    console.error(err);
    process.exit(1);
  });
}
