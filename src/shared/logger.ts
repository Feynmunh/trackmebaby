export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    module: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const DEFAULT_LEVEL: LogLevel = "info";
let logSink: ((entry: LogEntry) => void) | null = null;

export function setLogSink(sink: ((entry: LogEntry) => void) | null): void {
    logSink = sink;
}

function resolveLogLevel(): LogLevel {
    if (typeof Bun !== "undefined") {
        const envLevel = Bun.env.LOG_LEVEL;
        if (envLevel && LOG_LEVELS.includes(envLevel as LogLevel)) {
            return envLevel as LogLevel;
        }
    }
    return DEFAULT_LEVEL;
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minLevel);
}

function emit(entry: LogEntry): void {
    if (logSink) {
        logSink(entry);
        return;
    }
    // Fallback to console when no sink is configured
    const method =
        entry.level === "error"
            ? console.error
            : entry.level === "warn"
              ? console.warn
              : console.log;
    method(`[${entry.module}] ${entry.message}`, entry.data ?? "");
}

export function emitLog(entry: LogEntry): void {
    emit(entry);
}

export function createLogger(module: string): Logger {
    const minLevel = resolveLogLevel();

    const log = (
        level: LogLevel,
        message: string,
        data?: Record<string, unknown>,
    ) => {
        if (!shouldLog(level, minLevel)) return;
        emit({
            level,
            message,
            module,
            timestamp: new Date().toISOString(),
            data,
        });
    };

    return {
        debug: (message, data) => log("debug", message, data),
        info: (message, data) => log("info", message, data),
        warn: (message, data) => log("warn", message, data),
        error: (message, data) => log("error", message, data),
    };
}
