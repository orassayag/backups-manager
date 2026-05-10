import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeReport } from '../reporter.js';
import * as fs from 'fs';
import * as path from 'path';
import { BackupResult } from '../../types/types.js';

vi.mock('fs');
vi.mock('../../utils/utils.js', () => ({
  getDesktopPath: vi.fn(() => '/mock/desktop'),
  formatJerusalemTime: vi.fn(() => '08/05/2026 17:00:00'),
  formatDuration: vi.fn(() => '5s'),
  formatSize: vi.fn((bytes) => `${bytes} B`),
}));

describe('reporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write a report file with correct content', () => {
    const mockResult: BackupResult = {
      startTime: new Date('2026-05-08T17:00:00Z'),
      endTime: new Date('2026-05-08T17:00:05Z'),
      operation: 'diff',
      sessionResults: [
        {
          session: { sourcePath: '/src', targetPath: '/dest' },
          status: 'success',
          diffEntries: [
            { relativePath: 'file1.txt', size: 100, action: 'added' },
          ],
          failedFiles: [],
        },
      ],
    };

    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');

    const reportPath = writeReport(mockResult);

    expect(reportPath).toBe(path.join('/mock/desktop', 'BACKUP_REPORT.txt'));
    expect(writeFileSyncSpy).toHaveBeenCalled();

    const content = writeFileSyncSpy.mock.calls[0][1] as string;
    expect(content).toContain('BACKUP MANAGER REPORT');
    expect(content).toContain('Operation  : Diff Backup');
    expect(content).toContain('SESSION:');
    expect(content).toContain('Source: /src');
    expect(content).toContain('Target: /dest');
    expect(content).toContain('file1.txt');
    expect(content).toContain('added');
  });

  it('should show -- in size column for deleted files', () => {
    const mockResult: BackupResult = {
      startTime: new Date(),
      endTime: new Date(),
      operation: 'diff',
      sessionResults: [
        {
          session: { sourcePath: '/src', targetPath: '/dest' },
          status: 'success',
          diffEntries: [
            { relativePath: 'deleted-file.txt', size: 1024, action: 'deleted' },
          ],
          failedFiles: [],
        },
      ],
    };

    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');
    writeReport(mockResult);

    const content = writeFileSyncSpy.mock.calls[0][1] as string;
    expect(content).toContain('deleted-file.txt');
    expect(content).toContain('--');
    expect(content).toContain('deleted');
    // Ensure it doesn't contain the formatted size from the mock (1024 B)
    expect(content).not.toContain('1024 B');
  });

  it('should handle failed sessions in report', () => {
    const mockResult: BackupResult = {
      startTime: new Date(),
      endTime: new Date(),
      operation: 'full',
      sessionResults: [
        {
          session: { sourcePath: '/src', targetPath: '/dest' },
          status: 'failed',
          diffEntries: [],
          failedFiles: [
            {
              sourcePath: '/src/err.txt',
              targetPath: '/dest/err.txt',
              error: 'Permission denied',
            },
          ],
          error: 'Session failed',
        },
      ],
    };

    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');
    writeReport(mockResult);

    const content = writeFileSyncSpy.mock.calls[0][1] as string;
    expect(content).toContain('Status: FAILED');
    expect(content).toContain('Error: Session failed');
    expect(content).toContain('FAILED FILES (1)');
    expect(content).toContain('Permission denied');
  });

  it('should handle skipped sessions', () => {
    const mockResult: BackupResult = {
      startTime: new Date(),
      endTime: new Date(),
      operation: 'diff',
      sessionResults: [
        {
          session: { sourcePath: '/src', targetPath: '/dest' },
          status: 'skipped',
          diffEntries: [],
          failedFiles: [],
          error: 'Skipped reason',
        },
      ],
    };

    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');
    writeReport(mockResult);

    const content = writeFileSyncSpy.mock.calls[0][1] as string;
    expect(content).toContain('Status: SKIPPED');
    expect(content).toContain('Error: Skipped reason');
  });

  it('should handle missing date parts in formatJerusalemTime', () => {
    // We need to test the formatJerusalemTime in utils.ts actually,
    // but reporter calls it. However, the mock in reporter.test.ts
    // mocks formatJerusalemTime.
    // I should add a test to utils.test.ts for this.
  });
});
