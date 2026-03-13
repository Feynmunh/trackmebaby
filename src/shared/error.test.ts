import { describe, expect, test } from "bun:test";
import { safeJsonParse, toErrorData, toErrorMessage } from "./error.ts";

describe("toErrorMessage", () => {
    test("returns message for Error instances", () => {
        expect(toErrorMessage(new Error("boom"))).toBe("boom");
    });

    test("returns string values unchanged", () => {
        expect(toErrorMessage("plain text")).toBe("plain text");
    });

    test("returns JSON for serializable objects", () => {
        expect(toErrorMessage({ code: 42 })).toBe('{"code":42}');
    });

    test("falls back to String() for non-serializable values", () => {
        const circular: { self?: unknown } = {};
        circular.self = circular;
        expect(toErrorMessage(circular)).toContain("[object Object]");
    });
});

describe("safeJsonParse", () => {
    test("parses valid JSON", () => {
        const parsed = safeJsonParse<{ ok: boolean }>(
            '{"ok":true}',
            { ok: false },
            "test",
        );
        expect(parsed).toEqual({ ok: true });
    });

    test("returns fallback for null or undefined input", () => {
        expect(safeJsonParse<string[]>(null, ["fallback"], "test")).toEqual([
            "fallback",
        ]);
        expect(
            safeJsonParse<string[] | null>(undefined, ["fallback"], "test"),
        ).toEqual(["fallback"]);
    });

    test("returns fallback for malformed JSON", () => {
        const parsed = safeJsonParse<number[]>("{not-json", [1, 2], "test");
        expect(parsed).toEqual([1, 2]);
    });
});

describe("toErrorData", () => {
    test("maps Error to structured object", () => {
        const err = new Error("bad");
        const data = toErrorData(err);
        expect(data.name).toBe("Error");
        expect(data.message).toBe("bad");
        expect(typeof data.stack === "string" || data.stack === undefined).toBe(
            true,
        );
    });

    test("maps string to message field", () => {
        expect(toErrorData("oops")).toEqual({ message: "oops" });
    });

    test("wraps non-null object in error field", () => {
        const payload = { k: "v" };
        expect(toErrorData(payload)).toEqual({ error: payload });
    });

    test("stringifies primitive values", () => {
        expect(toErrorData(7)).toEqual({ message: "7" });
        expect(toErrorData(false)).toEqual({ message: "false" });
    });
});
