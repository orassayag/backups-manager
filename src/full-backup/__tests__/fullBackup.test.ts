import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFullBackup } from '../index.js';
import * as fs from 'fs';
import { Settings } from '../../settings/index.js';
import * as utils from '../../utils/index.js';

vi.mock('fs');
vi.mock('../../utils/index.js');
vi.mock('../../progress/index.js', () => {
  return {
    ProgressTracker: vi.fn().mockImplementation(function (this: any) {
      this.init = vi.fn();
      this.start = vi.fn();
      this.setScanning = vi.fn();
      this.setTotalFiles = vi.fn();
      this.setCopying = vi.fn();
      this.fileComplete = vi.fn();
      this.stop = vi.fn();
    }),
  };
});

describe('fullBackup', () => {
  const mockSettings: Settings = {
    excludeNames: [],
    excludePatterns: [],
    automaticMode: false,
    automaticOperation: 'full',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
  });

  it('should run full backup for sessions', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.toString().includes('sessions.json')) return true;
      if (p.toString() === '/src1') return true;
      return false;
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'resolvePath').mockImplementation((p) => p);
    vi.spyOn(utils, 'scanDirectory').mockReturnValue([
      {
        relativePath: 'file1.txt',
        absolutePath: '/src1/file1.txt',
        size: 100,
        mtime: 1234,
      },
    ]);
    vi.spyOn(utils, 'copyFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'statSync').mockReturnValue({
      atime: new Date(),
      mtime: new Date(),
    } as any);

    const result = await runFullBackup(mockSettings);

    expect(result.operation).toBe('full');
    expect(result.sessionResults).toHaveLength(1);
    expect(result.sessionResults[0].status).toBe('success');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/dest1', { recursive: true });
    expect(utils.copyFile).toHaveBeenCalledWith(
      '/src1/file1.txt',
      expect.stringContaining('file1.txt')
    );
  });

  it('should handle session validation failures', async () => {
    const sessions = [{ sourcePath: '', targetPath: '' }];
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));

    const result = await runFullBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('skipped');
    expect(result.sessionResults[0].error).toContain('missing or empty');
  });

  it('should handle non-existent source path', async () => {
    const sessions = [{ sourcePath: '/invalid', targetPath: '/dest' }];
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.toString().includes('sessions.json')) return true;
      return false;
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));

    const result = await runFullBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('skipped');
    expect(result.sessionResults[0].error).toContain('does not exist');
  });

  it('should handle directory entries in source', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'scanDirectory').mockReturnValue([
      {
        relativePath: 'subdir',
        absolutePath: '/src1/subdir',
        size: -1,
        mtime: 0,
      },
    ]);

    const result = await runFullBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('success');
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('subdir'),
      { recursive: true }
    );
  });

  it('should handle file copy errors', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'scanDirectory').mockReturnValue([
      {
        relativePath: 'f.txt',
        absolutePath: '/src1/f.txt',
        size: 10,
        mtime: 0,
      },
    ]);
    vi.spyOn(utils, 'copyFile').mockRejectedValue(new Error('copy error'));

    const result = await runFullBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('failed');
    expect(result.sessionResults[0].failedFiles[0].error).toBe('copy error');
  });

  it('should handle sessions file error', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('fs error');
    });

    await expect(runFullBackup(mockSettings)).rejects.toThrow(
      'Error reading sessions.json'
    );
  });

  it('should handle missing sessions file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(runFullBackup(mockSettings)).rejects.toThrow(
      'Sessions file not found'
    );
  });

  it('should handle null or empty sessions', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('null');

    await expect(runFullBackup(mockSettings)).rejects.toThrow(
      'No sessions found'
    );
  });
});
