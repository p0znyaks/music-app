/**
 * Minimal levelled logger.
 *
 * The backend used `console.*` everywhere, which made it impossible to tell an
 * operational message from a leftover debug print. Levels let deployments turn
 * detail down/up with one environment variable, and every line carries a
 * timestamp so container logs stay readable when interleaved.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : "info";
}

const threshold = LEVEL_ORDER[configuredLevel()];

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (LEVEL_ORDER[level] < threshold) {
    return;
  }
  const stamp = new Date().toISOString();
  const line = `${stamp} ${level.toUpperCase().padEnd(5)} [${scope}]`;
  // Error-first arguments keep their stack; the rest are plain values.
  if (level === "error") {
    console.error(line, ...args);
  } else if (level === "warn") {
    console.warn(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** Returns a logger tagged with `scope`, e.g. `createLogger('audio-cache')`. */
export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => emit("debug", scope, args),
    info: (...args) => emit("info", scope, args),
    warn: (...args) => emit("warn", scope, args),
    error: (...args) => emit("error", scope, args),
  };
}
