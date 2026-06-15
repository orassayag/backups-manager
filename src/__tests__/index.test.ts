import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../index.js';
import * as fs from 'fs';
import { showMainMenu, showConfirmation } from '../menu/index.js';
import { runFullBackup } from '../full-backup/index.js';
import { runDiffBackup } from '../diff-backup/index.js';
import { writeReport } from '../reporter/index.js';

// Mock all dependencies
vi.mock('fs');
vi.mock('../menu/index.js');
vi.mock('../full-backup/index.js');
vi.mock('../diff-backup/index.js');
vi.mock('../reporter/index.js');
vi.mock('../validators/index.js');

describe('index main', () => {
  let processExitSpy: any;
  let consoleLogSpy: any;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should run diff backup by default from menu', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('diff');
    vi.mocked(showConfirmation).mockResolvedValue(true);
    vi.mocked(runDiffBackup).mockResolvedValue({
      operation: 'diff',
      startTime: new Date(),
      endTime: new Date(),
      sessionResults: [],
    });
    vi.mocked(writeReport).mockReturnValue('/mock/report.txt');

    await main();

    expect(showMainMenu).toHaveBeenCalled();
    expect(showConfirmation).toHaveBeenCalled();
    expect(runDiffBackup).toHaveBeenCalled();
    expect(writeReport).toHaveBeenCalled();
  });

  it('should run full backup when selected', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('full');
    vi.mocked(showConfirmation).mockResolvedValue(true);
    vi.mocked(runFullBackup).mockResolvedValue({
      operation: 'full',
      startTime: new Date(),
      endTime: new Date(),
      sessionResults: [],
    });

    await main();

    expect(runFullBackup).toHaveBeenCalled();
  });

  it('should handle cancellation', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('diff');
    vi.mocked(showConfirmation).mockResolvedValue(false);

    await expect(main()).rejects.toThrow('process.exit');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should clear cache if selected', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('clear-cache');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    await expect(main()).rejects.toThrow('process.exit');
    expect(fs.rmSync).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle no cache found to clear', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('clear-cache');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(main()).rejects.toThrow('process.exit');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No cache found')
    );
  });

  it('should handle exit choice', async () => {
    vi.mocked(showMainMenu).mockResolvedValue('exit');

    await expect(main()).rejects.toThrow('process.exit');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should use CLI arguments for auto mode', async () => {
    process.argv = ['node', 'index.js', '--auto', '--operation=full'];
    vi.mocked(runFullBackup).mockResolvedValue({
      operation: 'full',
      startTime: new Date(),
      endTime: new Date(),
      sessionResults: [],
    });

    await main();

    expect(runFullBackup).toHaveBeenCalled();
    expect(showMainMenu).not.toHaveBeenCalled();
  });
});
