/**
 * Logger
 *
 * The ONLY logging entry point in the application.
 *
 * Rules:
 * - Never call console.* directly anywhere else in src/.
 * - Never log credentials. Values under AppConfig.logging.redactedKeys are
 *   masked automatically, at any depth.
 * - Log level is owned by AppConfig, never decided at the call site.
 *
 * When a crash reporting service is introduced, only this file changes.
 */

import { AppConfig, type LogLevel } from '@/core/config/AppConfig';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

const redactedKeys = new Set<string>(
  AppConfig.logging.redactedKeys.map(key => key.toLowerCase()),
);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[AppConfig.logging.level];
}

/**
 * Recursively masks sensitive values. Depth-limited and cycle-safe so that a
 * malformed payload can never turn a log call into a crash.
 */
function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }
  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map(item => redact(item, depth + 1, seen));
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = redactedKeys.has(key.toLowerCase())
      ? REDACTED
      : redact(entry, depth + 1, seen);
  }
  return result;
}

function emit(level: Exclude<LogLevel, 'silent'>, scope: string, message: string, context?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const prefix = `[${level.toUpperCase()}][${scope}]`;
  const payload = context === undefined ? undefined : redact(context);

  // The single permitted console.* usage in the codebase.
  switch (level) {
    case 'error':
      payload === undefined
        ? console.error(prefix, message)
        : console.error(prefix, message, payload);
      break;
    case 'warn':
      payload === undefined
        ? console.warn(prefix, message)
        : console.warn(prefix, message, payload);
      break;
    default:
      payload === undefined
        ? console.log(prefix, message)
        : console.log(prefix, message, payload);
  }
}

export interface ScopedLogger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

/**
 * Creates a logger bound to a module or service name, so log output is
 * traceable without every call site repeating its own identifier.
 *
 * @example
 * const log = createLogger('MockAuthService');
 * log.info('OTP requested', { phone });
 */
export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (message, context) => emit('debug', scope, message, context),
    info: (message, context) => emit('info', scope, message, context),
    warn: (message, context) => emit('warn', scope, message, context),
    error: (message, context) => emit('error', scope, message, context),
  };
}

export const Logger = createLogger('App');
