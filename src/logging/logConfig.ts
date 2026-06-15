import { LogLevel } from '../types/index';

export const LOG_CONFIG = {
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.DEBUG,
  logDir: 'logs',
  maxFileSize: 10 * 1024 * 1024,
  logRetentionDays: 30,
  enableConsole: false, // Set to false as per requirement
  enableFile: true,
};
