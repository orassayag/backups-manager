import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizePath,
  formatSize,
  formatElapsed,
  isExcluded,
  scanDirectory,
  formatDuration,
  formatJerusalemTime,
  copyFile,
  resolvePath,
  getDesktopPath,
} from '../utils.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('fs');
vi.mock('os');

describe('utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\Test\\Desktop')).toBe(
        'C:/Users/Test/Desktop'
      );
    });

    it('should leave forward slashes unchanged', () => {
      expect(normalizePath('C:/Users/Test/Desktop')).toBe(
        'C:/Users/Test/Desktop'
      );
    });
  });

  describe('resolvePath', () => {
    it('should resolve and normalize path', () => {
      const p = 'some/path';
      const resolved = path.resolve(p).replace(/\\/g, '/');
      expect(resolvePath(p)).toBe(resolved);
    });
  });

  describe('getDesktopPath', () => {
    it('should return desktop path for win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const originalEnv = process.env;

      // Case 1: USERPROFILE exists
      process.env = { ...originalEnv, USERPROFILE: 'C:\\Users\\Test' };
      expect(getDesktopPath()).toBe('C:\\Users\\Test\\Desktop');

      // Case 2: USERPROFILE missing, HOMEDRIVE/HOMEPATH exist
      process.env = {
        ...originalEnv,
        USERPROFILE: '',
        HOMEDRIVE: 'D:',
        HOMEPATH: '\\Users\\Test2',
      };
      expect(getDesktopPath()).toBe('D:\\Users\\Test2\\Desktop');

      // Case 3: All missing
      process.env = {
        ...originalEnv,
        USERPROFILE: '',
        HOMEDRIVE: '',
        HOMEPATH: '',
      };
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\Default');
      expect(getDesktopPath()).toBe('C:\\Users\\Default\\Desktop');

      process.env = originalEnv;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return desktop path for other platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.mocked(os.homedir).mockReturnValue('/home/test');

      expect(getDesktopPath()).toBe(path.join('/home/test', 'Desktop'));

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('isExcluded', () => {
    it('should return true if entry name is in excludeNames', () => {
      expect(
        isExcluded('node_modules', 'src/node_modules', ['node_modules'], [])
      ).toBe(true);
    });

    it('should return true if relPath matches excludePatterns', () => {
      expect(
        isExcluded('test.log', 'logs/test.log', [], ['*.log', 'logs/*.log'])
      ).toBe(true);
    });

    it('should return true if entry name matches excludePatterns', () => {
      expect(isExcluded('temp.tmp', 'some/path/temp.tmp', [], ['*.tmp'])).toBe(
        true
      );
    });

    it('should return false if no match', () => {
      expect(
        isExcluded('index.ts', 'src/index.ts', ['node_modules'], ['*.log'])
      ).toBe(false);
    });
  });

  describe('scanDirectory', () => {
    it('should recursively scan directory and return files', () => {
      const mockReaddirSync = vi.spyOn(fs, 'readdirSync');
      const mockStatSync = vi.spyOn(fs, 'statSync');

      mockReaddirSync.mockImplementation((dirPath: any) => {
        if (dirPath.toString().endsWith('root')) {
          return [
            {
              name: 'file1.txt',
              isFile: (): boolean => true,
              isDirectory: (): boolean => false,
            },
            {
              name: 'subdir',
              isFile: (): boolean => false,
              isDirectory: (): boolean => true,
            },
          ] as any;
        }
        if (dirPath.toString().endsWith('subdir')) {
          return [
            {
              name: 'file2.txt',
              isFile: (): boolean => true,
              isDirectory: (): boolean => false,
            },
          ] as any;
        }
        return [];
      });

      mockStatSync.mockImplementation((_filePath: any) => {
        return { size: 100, mtimeMs: 123456789 } as any;
      });

      const results = scanDirectory('root', [], []);

      expect(results).toHaveLength(2);
      expect(results[0].relativePath).toBe('file1.txt');
      expect(results[1].relativePath).toBe('subdir/file2.txt');

      mockReaddirSync.mockRestore();
      mockStatSync.mockRestore();
    });

    it('should respect exclusions during scan', () => {
      const mockReaddirSync = vi.spyOn(fs, 'readdirSync');
      const mockStatSync = vi.spyOn(fs, 'statSync');

      mockReaddirSync.mockImplementation((_dirPath: any) => {
        return [
          {
            name: 'file1.txt',
            isFile: (): boolean => true,
            isDirectory: (): boolean => false,
          },
          {
            name: 'node_modules',
            isFile: (): boolean => false,
            isDirectory: (): boolean => true,
          },
        ] as any;
      });

      mockStatSync.mockImplementation(() => ({ size: 100, mtimeMs: 0 }) as any);

      const results = scanDirectory('root', ['node_modules'], []);

      expect(results).toHaveLength(1);
      expect(results[0].relativePath).toBe('file1.txt');

      mockReaddirSync.mockRestore();
      mockStatSync.mockRestore();
    });

    it('should track empty directories with size -1', () => {
      const mockReaddirSync = vi.spyOn(fs, 'readdirSync');
      mockReaddirSync.mockImplementation((dirPath: any) => {
        if (dirPath.toString().endsWith('root')) {
          return [
            {
              name: 'emptyDir',
              isFile: (): boolean => false,
              isDirectory: (): boolean => true,
            },
          ] as any;
        }
        return []; // emptyDir is empty
      });

      const results = scanDirectory('root', [], []);
      expect(results).toHaveLength(1);
      expect(results[0].size).toBe(-1);
      expect(results[0].relativePath).toBe('emptyDir');

      mockReaddirSync.mockRestore();
    });

    it('should handle readdirSync error', () => {
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('access denied');
      });

      const results = scanDirectory('root', [], []);
      expect(results).toHaveLength(0);
    });

    it('should handle statSync error', () => {
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        return [
          {
            name: 'file1.txt',
            isFile: (): boolean => true,
            isDirectory: (): boolean => false,
          },
        ] as any;
      });
      vi.spyOn(fs, 'statSync').mockImplementation(() => {
        throw new Error('stat error');
      });

      const results = scanDirectory('root', [], []);
      expect(results).toHaveLength(0);
    });
  });

  describe('formatDuration', () => {
    it('should format ms correctly', () => {
      expect(formatDuration(3661000)).toBe('1h 1m 1s');
      expect(formatDuration(61000)).toBe('1m 1s');
      expect(formatDuration(1000)).toBe('1s');
    });
  });

  describe('formatJerusalemTime', () => {
    it('should format date correctly', () => {
      const date = new Date('2026-05-08T17:00:00Z');
      // Jerusalem is UTC+3 in May (DST)
      // So 17:00 UTC is 20:00 Jerusalem
      const result = formatJerusalemTime(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}:\d{2}/);
    });

    it('should handle missing parts with default values', () => {
      // Mock Intl.DateTimeFormat to return empty parts
      const mockFormatter = {
        formatToParts: vi.fn(() => []),
      };
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.stubGlobal('Intl', {
        ...Intl,
        DateTimeFormat: vi.fn().mockImplementation(function (this: any) {
          return mockFormatter;
        }),
      });

      const result = formatJerusalemTime(new Date());
      expect(result).toBe('00/00/00 00:00:00');

      vi.stubGlobal('Intl', {
        ...Intl,
        DateTimeFormat: originalDateTimeFormat,
      });
    });
  });

  describe('copyFile', () => {
    it('should copy file using streams', async () => {
      const mockReadStream = {
        on: vi.fn((event, cb) => {
          if (event === 'close') cb();
          return mockReadStream;
        }),
        pipe: vi.fn(),
      };
      const mockWriteStream = {
        on: vi.fn((event, cb) => {
          if (event === 'close') cb();
          return mockWriteStream;
        }),
        destroy: vi.fn(),
      };

      vi.spyOn(fs, 'createReadStream').mockReturnValue(mockReadStream as any);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriteStream as any);

      await expect(copyFile('src', 'dest')).resolves.toBeUndefined();
      expect(fs.createReadStream).toHaveBeenCalledWith('src');
      expect(fs.createWriteStream).toHaveBeenCalledWith('dest');
      expect(mockReadStream.pipe).toHaveBeenCalledWith(mockWriteStream);
    });

    it('should handle read stream error', async () => {
      const mockReadStream = {
        on: vi.fn((event, cb) => {
          if (event === 'error') cb(new Error('read error'));
          return mockReadStream;
        }),
        pipe: vi.fn(),
      };
      const mockWriteStream = {
        on: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      vi.spyOn(fs, 'createReadStream').mockReturnValue(mockReadStream as any);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriteStream as any);

      await expect(copyFile('src', 'dest')).rejects.toThrow('read error');
      expect(mockWriteStream.destroy).toHaveBeenCalled();
    });

    it('should handle write stream error', async () => {
      const mockReadStream = {
        on: vi.fn().mockReturnThis(),
        pipe: vi.fn(),
      };
      const mockWriteStream = {
        on: vi.fn((event, cb) => {
          if (event === 'error') cb(new Error('write error'));
          return mockWriteStream;
        }),
        destroy: vi.fn(),
      };

      vi.spyOn(fs, 'createReadStream').mockReturnValue(mockReadStream as any);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriteStream as any);

      await expect(copyFile('src', 'dest')).rejects.toThrow('write error');
      expect(mockWriteStream.destroy).toHaveBeenCalled();
    });
  });

  describe('formatSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatSize(0)).toBe('0 B');
    });

    it('should format KB correctly', () => {
      expect(formatSize(1024)).toBe('1.0 KB');
    });

    it('should format MB correctly', () => {
      expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format GB correctly', () => {
      expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should handle large units', () => {
      expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
    });
  });

  describe('formatElapsed', () => {
    it('should format seconds correctly', () => {
      expect(formatElapsed(3661)).toBe('01:01:01');
    });

    it('should format zero seconds correctly', () => {
      expect(formatElapsed(0)).toBe('00:00:00');
    });
  });
});
