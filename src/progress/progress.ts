/**
 * progress.ts
 * Wraps the `ora` spinner to show live backup progress.
 *
 * Formats:
 *   Scanning : Time: 00:03:32 | Scanning...
 *   Copying  : Time: 00:03:32 | 34.4% | Copying <source> to <target>
 */

import ora, { Ora } from 'ora';
import { formatElapsed } from '../utils/index';

export class ProgressTracker {
  private spinner: Ora;
  private startTime: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private totalFiles: number = 0;
  private completedFiles: number = 0;
  private mode: 'scanning' | 'copying' | 'creating_cache' = 'scanning';
  private currentSource: string = '';
  private currentTarget: string = '';
  private sourcePath: string = '';
  private currentTargetRoot: string = '';
  private lastUpdate: number = 0;

  constructor() {
    this.startTime = Date.now();
    this.spinner = ora({ spinner: 'dots', color: 'cyan' });
  }

  init(sourcePath: string): void {
    this.sourcePath = sourcePath;
  }

  start(): void {
    this.startTime = Date.now();
    this.spinner.start(this.buildText());
    this.timer = setInterval(() => {
      this.updateSpinner();
    }, 100); // Check more frequently but throttle buildText
  }

  setTotalFiles(total: number): void {
    this.totalFiles = total;
    this.completedFiles = 0;
  }

  setScanning(): void {
    this.mode = 'scanning';
    this.updateSpinner(true);
  }

  setCreatingCache(): void {
    this.mode = 'creating_cache';
    this.updateSpinner(true);
  }

  setCopying(source: string, target: string, targetRoot: string): void {
    this.mode = 'copying';
    this.currentSource = source;
    this.currentTarget = target;
    this.currentTargetRoot = targetRoot;
    this.updateSpinner(true);
  }

  fileComplete(): void {
    this.completedFiles++;
    this.updateSpinner();
  }

  private updateSpinner(force: boolean = false): void {
    const now = Date.now();
    // Throttle updates to ~10fps (100ms) to prevent flickering
    if (force || now - this.lastUpdate > 100) {
      this.spinner.text = this.buildText();
      this.lastUpdate = now;
    }
  }

  stop(success: boolean = true): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (success) {
      this.spinner.succeed(this.buildText());
    } else {
      this.spinner.warn(this.buildText());
    }
  }

  stopSilent(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.spinner.stop();
  }

  private elapsed(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private buildText(): string {
    const time = `Time: ${formatElapsed(this.elapsed())}`;
    if (this.mode === 'scanning') {
      return `${time} | Scanning...`;
    }
    if (this.mode === 'creating_cache') {
      return `${time} | Cache not found, creating cache....`;
    }
    const pct =
      this.totalFiles > 0
        ? ((this.completedFiles / this.totalFiles) * 100).toFixed(1)
        : '0.0';

    const sourceLine = `Source: ${this.sourcePath} | Target: ${this.currentTargetRoot}`;
    const copyLine = `Copying ${shorten(this.currentSource, 40)} to ${shorten(this.currentTarget, 40)}`;

    return `${time} | ${pct}% | \n ${sourceLine} \n ${copyLine}`;
  }
}

function shorten(p: string, maxLen: number): string {
  return p.length <= maxLen ? p : '...' + p.slice(p.length - (maxLen - 3));
}
