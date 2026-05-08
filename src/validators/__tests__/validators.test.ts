import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateSettings } from '../validators.js';
import { Settings } from '../../settings/settings.js';

describe('validators', () => {
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass with valid settings', () => {
    const validSettings: Settings = {
      excludeNames: ['node_modules'],
      excludePatterns: ['*.log'],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    expect(() => validateSettings(validSettings)).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should fail if excludeNames is not an array', () => {
    const invalidSettings: any = {
      excludeNames: 'not-an-array',
      excludePatterns: [],
      automaticMode: false,
      automaticOperation: 'diff',
    };

    expect(() => validateSettings(invalidSettings)).toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('excludeNames must be an array.'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should fail if excludePatterns is not an array', () => {
    const invalidSettings: any = {
      excludeNames: [],
      excludePatterns: null,
      automaticMode: false,
      automaticOperation: 'diff',
    };

    expect(() => validateSettings(invalidSettings)).toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('excludePatterns must be an array.'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should fail if automaticOperation is invalid when automaticMode is true', () => {
    const invalidSettings: any = {
      excludeNames: [],
      excludePatterns: [],
      automaticMode: true,
      automaticOperation: 'invalid',
    };

    expect(() => validateSettings(invalidSettings)).toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('automaticOperation must be "full" or "diff"'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should pass if automaticOperation is valid when automaticMode is true', () => {
    const validSettings: Settings = {
      excludeNames: [],
      excludePatterns: [],
      automaticMode: true,
      automaticOperation: 'full',
    };

    expect(() => validateSettings(validSettings)).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
