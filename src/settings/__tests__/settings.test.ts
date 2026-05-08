import { describe, it, expect } from 'vitest';
import settings from '../settings.js';

describe('settings', () => {
  it('should have default values', () => {
    expect(settings).toHaveProperty('excludeNames');
    expect(settings).toHaveProperty('excludePatterns');
    expect(settings.automaticMode).toBe(false);
    expect(settings.automaticOperation).toBe('diff');
  });
});
