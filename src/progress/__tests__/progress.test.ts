import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressTracker } from '../progress.js';
import ora from 'ora';

vi.mock('ora', () => {
  const mockOra = {
    start: vi.fn(function (this: any, text: string) {
      if (text) this.text = text;
      return this;
    }),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  };
  return {
    default: vi.fn(() => mockOra),
  };
});

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockOraInstance: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T17:00:00Z'));
    tracker = new ProgressTracker();
    mockOraInstance = (ora as any)();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize and start scanning', () => {
    tracker.init('/source/path');
    tracker.start();
    expect(mockOraInstance.start).toHaveBeenCalled();
    expect(mockOraInstance.text).toContain('Scanning...');
  });

  it('should update progress during copying', () => {
    tracker.init('/source/path');
    tracker.start();
    tracker.setTotalFiles(10);
    tracker.setCopying('file.txt', 'target/file.txt', 'target');

    expect(mockOraInstance.text).toContain('0.0%');
    expect(mockOraInstance.text).toContain('file.txt');

    vi.setSystemTime(new Date(Date.now() + 200));
    tracker.fileComplete(); // 1/10 = 10%
    expect(mockOraInstance.text).toContain('10.0%');

    vi.setSystemTime(new Date(Date.now() + 200));
    tracker.fileComplete(); // 2/10 = 20%
    expect(mockOraInstance.text).toContain('20.0%');
  });

  it('should handle zero total files in percent calculation', () => {
    tracker.init('/src');
    tracker.start();
    tracker.setTotalFiles(0);
    tracker.setCopying('f', 't', 'r');
    expect(mockOraInstance.text).toContain('0.0%');
  });

  it('should throttle updates', () => {
    tracker.start();
    tracker.setScanning();
    const firstText = mockOraInstance.text;

    // Immediate call shouldn't update text again (throttled)
    tracker.setScanning();
    expect(mockOraInstance.text).toBe(firstText);

    // After 200ms it should update
    vi.advanceTimersByTime(200);
    tracker.setScanning();
    // In this case it's the same text, but let's check if buildText was called or logic passed
  });

  it('should show creating cache mode', () => {
    tracker.start();
    tracker.setCreatingCache();
    expect(mockOraInstance.text).toContain('Cache not found');
  });

  it('should stop with success', () => {
    tracker.start();
    tracker.stop(true);
    expect(mockOraInstance.succeed).toHaveBeenCalled();
    // Test timer cleanup
    tracker.stop(true); // Should handle no timer
  });

  it('should stop with warning', () => {
    tracker.start();
    tracker.stop(false);
    expect(mockOraInstance.warn).toHaveBeenCalled();
  });

  it('should stop silently', () => {
    tracker.start();
    tracker.stopSilent();
    expect(mockOraInstance.stop).toHaveBeenCalled();
    // Test timer cleanup
    tracker.stopSilent(); // Should handle no timer
  });
});
