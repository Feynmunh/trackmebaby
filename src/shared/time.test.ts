import { describe, expect, test } from "bun:test";
import { isIsoWithinMs, timeAgo } from "./time.ts";

describe("timeAgo", () => {
    test("returns empty label for null date", () => {
        expect(timeAgo(null)).toBe("");
        expect(timeAgo(null, { emptyLabel: "never" })).toBe("never");
    });

    test("returns just now label for sub-minute timestamps", () => {
        const originalNow = Date.now;
        Date.now = () => new Date("2026-01-01T10:00:30.000Z").getTime();
        try {
            expect(timeAgo("2026-01-01T10:00:00.000Z")).toBe("just now");
            expect(
                timeAgo("2026-01-01T10:00:00.000Z", {
                    justNowLabel: "moments ago",
                }),
            ).toBe("moments ago");
        } finally {
            Date.now = originalNow;
        }
    });

    test("returns minutes, hours, and days labels", () => {
        const originalNow = Date.now;
        Date.now = () => new Date("2026-01-08T12:00:00.000Z").getTime();
        try {
            expect(timeAgo("2026-01-08T11:30:00.000Z")).toBe("30m ago");
            expect(timeAgo("2026-01-08T10:00:00.000Z")).toBe("2h ago");
            expect(timeAgo("2026-01-05T12:00:00.000Z")).toBe("3d ago");
        } finally {
            Date.now = originalNow;
        }
    });

    test("falls back to locale date string beyond maxDays", () => {
        const originalNow = Date.now;
        Date.now = () => new Date("2026-01-20T12:00:00.000Z").getTime();
        try {
            expect(timeAgo("2026-01-01T12:00:00.000Z", { maxDays: 7 })).toBe(
                new Date("2026-01-01T12:00:00.000Z").toLocaleDateString(),
            );
        } finally {
            Date.now = originalNow;
        }
    });
});

describe("isIsoWithinMs", () => {
    test("returns false for null or invalid dates", () => {
        expect(isIsoWithinMs(null, 1000)).toBe(false);
        expect(isIsoWithinMs("not-a-date", 1000)).toBe(false);
    });

    test("returns true when timestamp is inside max age", () => {
        const now = new Date("2026-02-01T00:00:01.000Z").getTime();
        expect(isIsoWithinMs("2026-02-01T00:00:00.500Z", 1000, now)).toBe(true);
    });

    test("returns false when timestamp exceeds max age", () => {
        const now = new Date("2026-02-01T00:00:10.000Z").getTime();
        expect(isIsoWithinMs("2026-02-01T00:00:00.000Z", 1000, now)).toBe(
            false,
        );
    });
});
