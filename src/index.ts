import settings from './settings/settings';
import { validateSettings } from './validators/validators';
import { showMainMenu, showConfirmation } from './menu/menu';
import { runFullBackup } from './full-backup/fullBackup';
import { runDiffBackup } from './diff-backup/diffBackup';
import { writeReport } from './reporter/reporter';
import { BackupResult } from './types/types';

async function main(): Promise<void> {
  // 1. Validation
  validateSettings(settings);

  let operation: 'full' | 'diff' | 'exit';

  // 2. Mode selection
  if (settings.automaticMode) {
    operation = settings.automaticOperation;
  } else {
    operation = await showMainMenu();
  }

  if (operation === 'exit') {
    console.log('Exiting...');
    process.exit(0);
  }

  // 3. Confirmation (Skip if automatic)
  if (!settings.automaticMode) {
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
  let result: BackupResult;
  if (operation === 'full') {
    result = await runFullBackup(settings);
  } else {
    result = await runDiffBackup(settings);
  }

  // 5. Reporting
  const reportPath = writeReport(result);
  console.log(`\n✅ Backup complete!`);
  console.log(`📄 Report generated at: ${reportPath}`);
}

main().catch((err) => {
  console.error('\n❌ A critical error occurred:');
  console.error(err);
  process.exit(1);
});
