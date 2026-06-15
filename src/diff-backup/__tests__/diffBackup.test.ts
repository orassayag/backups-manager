import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiffBackup } from '../index.js';
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

describe('diffBackup', () => {
  const mockSettings: Settings = {
    excludeNames: [],
    excludePatterns: [],
    automaticMode: false,
    automaticOperation: 'diff',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
  });

  it('should run diff backup for sessions', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      const ps = p.toString().replace(/\\/g, '/');
      if (ps.includes('sessions.json')) return true;
      if (ps.startsWith('/src1')) return true;
      if (ps.startsWith('/dest1')) return true;
      return false;
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'resolvePath').mockImplementation((p) => p);
    vi.spyOn(utils, 'scanDirectory').mockImplementation((dir: string) => {
      if (dir === '/src1') {
        return [
          {
            relativePath: 'file1.txt',
            absolutePath: '/src1/file1.txt',
            size: 100,
            mtime: 1234,
          },
        ];
      }
      return [];
    });
    vi.spyOn(utils, 'copyFile').mockResolvedValue(undefined);
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 50,
      mtimeMs: 0,
      atime: new Date(),
      mtime: new Date(),
      isDirectory: () => false,
    } as any);

    const result = await runDiffBackup(mockSettings);

    expect(result.operation).toBe('diff');
    expect(result.sessionResults).toHaveLength(1);
    expect(result.sessionResults[0].status).toBe('success');
    expect(result.sessionResults[0].diffEntries).toHaveLength(1);
    expect(result.sessionResults[0].diffEntries[0].action).toBe('updated');
  });

  it('should identify deleted files using cache', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    const mockCache = {
      'old-file.txt': { size: 50, mtime: 0 },
    };

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      const ps = p.toString().replace(/\\/g, '/');
      if (ps.includes('sessions.json')) return true;
      if (ps.includes('cache-')) return true;
      if (ps.startsWith('/src1')) return true;
      if (ps.startsWith('/dest1')) return true;
      return false;
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.toString().includes('sessions.json'))
        return JSON.stringify(sessions);
      if (p.toString().includes('cache-')) return JSON.stringify(mockCache);
      return '';
    });

    vi.spyOn(utils, 'resolvePath').mockImplementation((p) => p);
    vi.spyOn(utils, 'scanDirectory').mockReturnValue([]); // Source is empty

    const result = await runDiffBackup(mockSettings);

    expect(result.sessionResults[0].diffEntries).toHaveLength(1);
    expect(result.sessionResults[0].diffEntries[0].action).toBe('deleted');
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('should handle session validation failures', async () => {
    const sessions = [{ sourcePath: '', targetPath: '' }]; // Missing paths
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));

    const result = await runDiffBackup(mockSettings);
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

    const result = await runDiffBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('skipped');
    expect(result.sessionResults[0].error).toContain('does not exist');
  });

  it('should handle cache read errors', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.toString().includes('sessions.json'))
        return JSON.stringify(sessions);
      if (p.toString().includes('cache-')) throw new Error('read error');
      return '';
    });
    vi.spyOn(utils, 'scanDirectory').mockReturnValue([]);

    const result = await runDiffBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('success'); // Should fallback to empty cache
  });

  it('should handle orphan deletion and directory removal', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'scanDirectory').mockImplementation((dir: string) => {
      if (dir === '/src1') return [];
      if (dir === '/dest1')
        return [
          {
            relativePath: 'orphan',
            absolutePath: '/dest1/orphan',
            size: 10,
            mtime: 0,
          },
        ];
      return [];
    });
    vi.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => true,
    } as any);

    const result = await runDiffBackup(mockSettings);
    expect(result.sessionResults[0].diffEntries[0].action).toBe('deleted');
    expect(fs.rmSync).toHaveBeenCalled();
  });

  it('should handle identical files and different files', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      const ps = p.toString().replace(/\\/g, '/');
      if (ps.includes('sessions.json')) return true;
      if (ps.startsWith('/src1')) return true; // Source must exist for scanDirectory
      if (ps.includes('identical.txt')) return true;
      if (ps.includes('different.txt')) return true;
      return false;
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(sessions));
    vi.spyOn(utils, 'scanDirectory').mockImplementation((dir: string) => {
      if (dir === '/src1')
        return [
          {
            relativePath: 'identical.txt',
            absolutePath: '/src1/identical.txt',
            size: 100,
            mtime: 1000,
          },
          {
            relativePath: 'different.txt',
            absolutePath: '/src1/different.txt',
            size: 200,
            mtime: 2000,
          },
        ];
      return [];
    });
    vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
      const ps = p.toString().replace(/\\/g, '/');
      if (ps.includes('identical.txt'))
        return { size: 100, mtimeMs: 1000, isDirectory: () => false } as any;
      if (ps.includes('different.txt'))
        return { size: 200, mtimeMs: 5000, isDirectory: () => false } as any; // mtime mismatch
      return { size: 0, mtimeMs: 0, isDirectory: () => false } as any;
    });

    const result = await runDiffBackup(mockSettings);
    // Only different.txt should be in diffEntries (identical.txt is ignored because it exists and matches)
    expect(result.sessionResults[0].diffEntries).toHaveLength(1);
    expect(result.sessionResults[0].diffEntries[0].relativePath).toBe(
      'different.txt'
    );
    expect(result.sessionResults[0].diffEntries[0].action).toBe('updated');
  });

  it('should handle alreadyInDiff check for orphans', async () => {
    const sessions = [{ sourcePath: '/src1', targetPath: '/dest1' }];
    const mockCache = { 'orphan.txt': { size: 10, mtime: 0 } };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.toString().includes('sessions.json'))
        return JSON.stringify(sessions);
      if (p.toString().includes('cache-')) return JSON.stringify(mockCache);
      return '';
    });
    vi.spyOn(utils, 'scanDirectory').mockImplementation((dir: string) => {
      if (dir === '/src1') return [];
      if (dir === '/dest1')
        return [
          {
            relativePath: 'orphan.txt',
            absolutePath: '/dest1/orphan.txt',
            size: 10,
            mtime: 0,
          },
        ];
      return [];
    });
    vi.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => false,
    } as any);

    const result = await runDiffBackup(mockSettings);
    // Should only have one deleted entry even if found in cache and target scan
    expect(result.sessionResults[0].diffEntries).toHaveLength(1);
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
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 5,
      mtimeMs: 0,
      isDirectory: () => false,
    } as any);
    vi.spyOn(utils, 'copyFile').mockRejectedValue(new Error('copy error'));

    const result = await runDiffBackup(mockSettings);
    expect(result.sessionResults[0].status).toBe('failed');
    expect(result.sessionResults[0].failedFiles[0].error).toBe('copy error');
  });

  it('should handle sessions file error', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('fs error');
    });

    await expect(runDiffBackup(mockSettings)).rejects.toThrow(
      'Error reading sessions.json'
    );
  });

  it('should handle sessions file missing', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(runDiffBackup(mockSettings)).rejects.toThrow(
      'Sessions file not found'
    );
  });

  it('should handle empty sessions array', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('null');

    await expect(runDiffBackup(mockSettings)).rejects.toThrow(
      'No sessions found'
    );
  });
});
