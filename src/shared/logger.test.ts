import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createLogger, emitLog, type LogEntry, setLogSink } from "./logger.ts";

const bunEnv = Bun.env as Record<string, string | undefined>;
let previousLogLevel: string | undefined;

beforeEach(() => {
    previousLogLevel = bunEnv.LOG_LEVEL;
});

afterEach(() => {
    setLogSink(null);
    if (previousLogLevel !== undefined) {
        bunEnv.LOG_LEVEL = previousLogLevel;
    } else {
        delete bunEnv.LOG_LEVEL;
    }
});

describe("createLogger", () => {
    test("emits structured entries to sink", () => {
        const entries: LogEntry[] = [];
        setLogSink((entry) => entries.push(entry));

        const logger = createLogger("test-module");
        logger.info("hello", { count: 1 });

        expect(entries).toHaveLength(1);
        expect(entries[0].module).toBe("test-module");
        expect(entries[0].level).toBe("info");
        expect(entries[0].message).toBe("hello");
        expect(entries[0].data).toEqual({ count: 1 });
        expect(Number.isNaN(Date.parse(entries[0].timestamp))).toBe(false);
    });

    test("applies LOG_LEVEL filtering at logger creation time", () => {
        bunEnv.LOG_LEVEL = "warn";

        const entries: LogEntry[] = [];
        setLogSink((entry) => entries.push(entry));

        const logger = createLogger("level-test");
        logger.debug("debug");
        logger.info("info");
        logger.warn("warn");
        logger.error("error");

        expect(entries.map((entry) => entry.level)).toEqual(["warn", "error"]);
    });
});

describe("emitLog", () => {
    test("writes provided log entry to sink", () => {
        const entries: LogEntry[] = [];
        setLogSink((entry) => entries.push(entry));

        emitLog({
            level: "error",
            message: "boom",
            module: "emit",
            timestamp: "2026-01-01T00:00:00.000Z",
            data: { reason: "test" },
        });

        expect(entries).toEqual([
            {
                level: "error",
                message: "boom",
                module: "emit",
                timestamp: "2026-01-01T00:00:00.000Z",
                data: { reason: "test" },
            },
        ]);
    });
});
