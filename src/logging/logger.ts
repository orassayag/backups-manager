import { promises as fs } from 'fs';
import { join } from 'path';
import { LogLevel, LogEntry } from '../types/logger';
import { LOG_CONFIG } from './logConfig';

export class Logger {
  private context: string = 'App';

  constructor(context?: string) {
    if (context) {
      this.context = context;
    }
  }

  setContext(context: string): void {
    this.context = context;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(
    message: string,
    error?: unknown,
    data?: Record<string, unknown>
  ): void {
    const errorDetails =
      error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : {
            error: String(error),
          };

    this.log(LogLevel.ERROR, message, {
      ...data,
      ...errorDetails,
    });
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      data,
    };

    if (LOG_CONFIG.enableConsole && this.shouldLog(level)) {
      const formattedMessage = `[${level.toUpperCase()}] [${this.context}] ${message}`;
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }

    if (LOG_CONFIG.enableFile) {
      this.writeToFile(entry).catch(() => {
        // Silent error to avoid console pollution as requested,
        // but normally we'd want to know if logging fails.
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    };
    const configLevel = LOG_CONFIG.level.toLowerCase() as LogLevel;
    const configLevelValue = levels[configLevel] ?? 0;
    return levels[level] >= configLevelValue;
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    const logFilePath = join(process.cwd(), LOG_CONFIG.logDir, 'app.log');
    const logLine = JSON.stringify(entry) + '\n';
    try {
      await fs.mkdir(join(process.cwd(), LOG_CONFIG.logDir), {
        recursive: true,
      });
      await fs.appendFile(logFilePath, logLine);
    } catch {
      // Don't use console.error here as per requirement
    }
  }
}
