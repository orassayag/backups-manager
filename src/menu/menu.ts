/**
 * menu.ts
 * Interactive CLI menu using inquirer.
 */

import inquirer from 'inquirer';
import { Settings } from '../settings/settings';
import { resolvePath } from '../utils/utils';

export type MenuChoice = 'full' | 'diff' | 'clear-cache' | 'exit';

/** Display the main operation menu and return the user's choice. */
export async function showMainMenu(): Promise<MenuChoice> {
  const { operation } = await inquirer.prompt<{ operation: MenuChoice }>([
    {
      type: 'list',
      name: 'operation',
      message: 'Select an operation:',
      choices: [
        { name: '1. Full backup', value: 'full' },
        { name: '2. Diff backup', value: 'diff' },
        { name: '3. Clear cache', value: 'clear-cache' },
        { name: '4. Exit', value: 'exit' },
      ],
    },
  ]);
  return operation;
}

/**
 * Display confirmation prompt showing source, targets, and exclusions.
 * Returns true if user confirms.
 */
export function showConfirmation(
  settings: Settings,
  operation: 'full' | 'diff'
): Promise<boolean> {
  const sourcePath = resolvePath(settings.sourcePath);
  const targetPaths = settings.targetPaths.map(resolvePath);

  console.log('\n' + '─'.repeat(60));
  console.log(
    `  Operation : ${operation === 'full' ? 'Full Backup' : 'Diff Backup'}`
  );
  console.log(`  Source    : ${sourcePath}`);
  console.log('  Targets   :');
  targetPaths.forEach((t) => console.log(`              ${t}`));
  if (settings.excludeNames.length > 0) {
    console.log(`  Exclude names    : ${settings.excludeNames.join(', ')}`);
  }
  if (settings.excludePatterns.length > 0) {
    console.log(`  Exclude patterns : ${settings.excludePatterns.join(', ')}`);
  }
  console.log('─'.repeat(60) + '\n');

  return new Promise((resolve) => {
    process.stdout.write('Proceed with backup? (y/n): ');

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (data: string): void => {
      const key = data.toLowerCase();
      if (key === 'y' || key === 'n' || key === '\u0003') {
        // Clean up
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write(key + '\n');

        if (key === '\u0003') {
          // Ctrl+C
          process.exit(0);
        }
        resolve(key === 'y');
      }
    };

    process.stdin.on('data', onData);
  });
}
