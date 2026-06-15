import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showMainMenu, showConfirmation } from '../index.js';
import pkg from 'enquirer';
const { Select } = pkg as any;
import * as fs from 'fs';
import { Settings } from '../../settings/index.js';

vi.mock('enquirer', () => {
  const Select = vi.fn().mockImplementation(function (this: any) {
    this.run = vi.fn().mockResolvedValue('full');
  });
  return {
    default: { Select },
    Select,
  };
});
vi.mock('fs');

describe('menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show main menu and return choice', async () => {
    const choice = await showMainMenu();

    expect(choice).toBe('full');
    expect(Select).toHaveBeenCalled();
  });

  it('should return "exit" if main menu is cancelled', async () => {
    vi.mocked(Select).mockImplementationOnce(function (this: any) {
      this.run = vi.fn().mockRejectedValue(new Error('cancelled'));
    });

    const choice = await showMainMenu();

    expect(choice).toBe('exit');
  });

  it('should show confirmation and return true on "y"', async () => {
    const mockSettings: Settings = {
      excludeNames: ['node_modules'],
      excludePatterns: ['*.log'],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    // Mock stdin
    const mockStdin = {
      isTTY: true,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          // Simulate user pressing 'y'
          setTimeout(() => callback('y'), 10);
        }
      }),
      removeListener: vi.fn(),
    };
    vi.stubGlobal('process', {
      ...process,
      stdin: mockStdin,
      stdout: {
        ...process.stdout,
        write: vi.fn(),
      },
    });

    const confirmed = await showConfirmation(mockSettings, 'full');

    expect(confirmed).toBe(true);
    expect(mockStdin.resume).toHaveBeenCalled();
  });

  it('should return false on "n"', async () => {
    const mockSettings: Settings = {
      excludeNames: [],
      excludePatterns: [],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    const mockStdin = {
      isTTY: false,
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'data') setTimeout(() => callback('n'), 10);
      }),
      removeListener: vi.fn(),
    };
    vi.stubGlobal('process', {
      ...process,
      stdin: mockStdin,
      stdout: { ...process.stdout, write: vi.fn() },
    });

    const confirmed = await showConfirmation(mockSettings, 'diff');
    expect(confirmed).toBe(false);
  });

  it('should exit on Ctrl+C', async () => {
    const mockSettings: Settings = {
      excludeNames: [],
      excludePatterns: [],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Instead of throwing, we'll just check if it was called
      return undefined as never;
    });

    let dataCallback: any;
    const mockStdin = {
      isTTY: true,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'data') dataCallback = callback;
      }),
      removeListener: vi.fn(),
    };
    vi.stubGlobal('process', {
      ...process,
      exit: exitSpy,
      stdin: mockStdin,
      stdout: { ...process.stdout, write: vi.fn() },
    });

    const promise = showConfirmation(mockSettings, 'diff');

    // Trigger Ctrl+C
    dataCallback('\u0003');

    await promise;

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle sessions.json being present or absent', async () => {
    const mockSettings: Settings = {
      excludeNames: ['node_modules'],
      excludePatterns: ['*.log'],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    // Case 1: sessions.json exists
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify([{ sourcePath: 's', targetPath: 't' }])
    );
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockStdin = {
      isTTY: false,
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'data') setTimeout(() => callback('y'), 10);
      }),
      removeListener: vi.fn(),
    };
    vi.stubGlobal('process', {
      ...process,
      stdin: mockStdin,
      stdout: { ...process.stdout, write: vi.fn() },
    });

    await showConfirmation(mockSettings, 'full');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('s -> t'));

    // Case 2: sessions.json parse error
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('parse error');
    });
    await showConfirmation(mockSettings, 'full');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No sessions found')
    );
  });
});
