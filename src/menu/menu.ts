/**
 * menu.ts
 * Interactive CLI menu using enquirer.
 */

import pkg from 'enquirer';
const { Select } = pkg as any;
import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../settings/index';
import { Session } from '../types/index';

export type MenuChoice = 'full' | 'diff' | 'clear-cache' | 'exit';

/** Display the main operation menu and return the user's choice. */
export async function showMainMenu(): Promise<MenuChoice> {
  const prompt = new Select({
    name: 'operation',
    message: 'Select an operation:',
    choices: [
      { name: 'full', message: '1. Full backup' },
      { name: 'diff', message: '2. Diff backup' },
      { name: 'clear-cache', message: '3. Clear cache' },
      { name: 'exit', message: '4. Exit' },
    ],
  });

  try {
    return (await prompt.run()) as MenuChoice;
  } catch {
    // Handle prompt cancellation
    return 'exit';
  }
}

/**
 * Display confirmation prompt showing sessions and exclusions.
 * Returns true if user confirms.
 */
export function showConfirmation(
  settings: Settings,
  operation: 'full' | 'diff'
): Promise<boolean> {
  const sessionsPath = path.join(
    process.cwd(),
    'src',
    'sessions',
    'sessions.json'
  );

  let sessions: Session[] = [];
  if (fs.existsSync(sessionsPath)) {
    try {
      sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `  Operation : ${operation === 'full' ? 'Full Backup' : 'Diff Backup'}`
  );
  console.log('  Sessions  :');
  if (sessions.length > 0) {
    sessions.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.sourcePath} -> ${s.targetPath}`);
    });
  } else {
    console.log('    (No sessions found or sessions.json is missing)');
  }

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
