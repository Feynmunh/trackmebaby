import { createLogger } from "./logger.ts";

const logger = createLogger("error");

export function toErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === "string") {
        return err;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

export function safeJsonParse<T>(
    raw: string | null | undefined,
    fallback: T,
    context: string,
): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch (err: unknown) {
        logger.warn("json parse failed", {
            context,
            error: toErrorData(err),
        });
        return fallback;
    }
}

export function toErrorData(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }

    if (typeof err === "string") {
        return { message: err };
    }

    if (typeof err === "object" && err !== null) {
        return { error: err } as Record<string, unknown>;
    }

    return { message: String(err) };
}
