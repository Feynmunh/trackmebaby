import { Database } from "bun:sqlite";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    mock,
    spyOn,
    test,
} from "bun:test";
import type { GitSnapshot } from "../../shared/types.ts";
import { upsertProject } from "../db/queries.ts";
import { runMigrations } from "../db/schema.ts";
import { SettingsService } from "./settings.ts";

let db: Database;
let projectId: string;
let getSettingValue: string | null = null;
let originalFetch: typeof fetch;
let originalNow: typeof Date.now;

let mockGetSetting: ReturnType<typeof mock>;
let mockInsertWardenInsight: ReturnType<typeof mock>;
let mockFetch: ReturnType<typeof mock>;

let WardenService: typeof import("./warden.ts").WardenService;
let settingsService: SettingsService;

const VALID_RESPONSE = JSON.stringify({
    insights: [
        {
            severity: "info",
            category: "suggestion",
            title: "Improve docs",
            description: "Add more examples to the README",
            affectedFiles: ["README.md"],
        },
    ],
});

const INVALID_RESPONSE = "not json";

const buildFetchResponse = (content: string): Response => {
    return {
        ok: true,
        json: () =>
            Promise.resolve({
                choices: [{ message: { content } }],
            }),
    } as unknown as Response;
};

const buildErrorResponse = (status: number): Response => {
    return {
        ok: false,
        status,
        text: () => Promise.resolve("AI query failed"),
    } as unknown as Response;
};

const createMockFetch = (content: string): ReturnType<typeof mock> =>
    mock((input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Promise.resolve(buildFetchResponse(content));
    });

// Note: We use spyOn instead of mock.module to avoid polluting module state
// that persists across test files
const setupModuleMocks = async (): Promise<void> => {
    const queriesModule = await import("../db/queries.ts");

    // Spy on getSetting to return our test value
    mockGetSetting = spyOn(queriesModule, "getSetting").mockImplementation(
        () => getSettingValue,
    );

    // Keep the real insertWardenInsight but spy on it
    const realInsertWardenInsight = queriesModule.insertWardenInsight;
    mockInsertWardenInsight = spyOn(
        queriesModule,
        "insertWardenInsight",
    ).mockImplementation(
        (...args: Parameters<typeof realInsertWardenInsight>) =>
            realInsertWardenInsight(...args),
    );

    // Mock warden-context
    const contextModule = await import("./ai/warden-context.ts");
    spyOn(contextModule, "assembleWardenContext").mockImplementation(() =>
        Promise.resolve("context"),
    );

    const module = await import("./warden.ts");
    WardenService = module.WardenService;
};

beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    const project = upsertProject(db, "/test/path", "test-project");
    projectId = project.id;

    settingsService = new SettingsService(db);

    getSettingValue = "test-key";
    originalFetch = globalThis.fetch;
    originalNow = Date.now;
    process.env.GROQ_API_KEY = "test-key";
    mockFetch = createMockFetch(VALID_RESPONSE);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await setupModuleMocks();
});

afterEach(() => {
    // Restore all spies
    mockGetSetting?.mockRestore?.();
    mockInsertWardenInsight?.mockRestore?.();
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
});

describe("WardenService", () => {
    test("initializes correctly", () => {
        const service = new WardenService(db, settingsService);
        expect(service).toBeDefined();
    });

    test("runs analysis and inserts insights", async () => {
        const service = new WardenService(db, settingsService);
        const insights = await service.analyzeProject(projectId, false);

        expect(insights.length).toBe(1);
        expect(insights[0].title).toBe("Improve docs");
        expect(mockInsertWardenInsight).toHaveBeenCalled();
    });

    test("respects cooldown period", async () => {
        const service = new WardenService(db, settingsService);

        await service.analyzeProject(projectId, false);
        const second = await service.analyzeProject(projectId, false);

        expect(second.length).toBe(0);
        expect(mockFetch.mock.calls.length).toBe(1);
    });

    test("manual trigger bypasses cooldown", async () => {
        const service = new WardenService(db, settingsService);

        await service.analyzeProject(projectId, false);
        // Manual bypass still has a 60s cooldown now, so we need to wait or mock time
        // For the test, we'll just mock the lastRunAt map to be old
        (
            service as unknown as { lastRunAt: Map<string, number> }
        ).lastRunAt.set(projectId, Date.now() - 61000);
        const second = await service.analyzeProject(projectId, true);

        expect(second.length).toBe(1);
    });

    test("skips analysis when API key is missing", async () => {
        const originalGroq = process.env.GROQ_API_KEY;
        const originalAi = process.env.AI_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.AI_API_KEY;

        const service = new WardenService(db, settingsService);
        const result = await service.analyzeProject(projectId, false);

        process.env.GROQ_API_KEY = originalGroq;
        process.env.AI_API_KEY = originalAi;

        expect(result.length).toBe(0);
    });

    test("does not call fetch when API key is missing", async () => {
        const originalGroq = process.env.GROQ_API_KEY;
        const originalAi = process.env.AI_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.AI_API_KEY;

        const service = new WardenService(db, settingsService);
        await service.analyzeProject(projectId, false);

        process.env.GROQ_API_KEY = originalGroq;
        process.env.AI_API_KEY = originalAi;

        expect(mockFetch.mock.calls.length).toBe(0);
    });

    test("triggers analysis when commit hash changes", async () => {
        const service = new WardenService(db, settingsService);
        const analyzeSpy = spyOn(service, "analyzeProject").mockImplementation(
            async () => [],
        );

        const first: GitSnapshot = {
            id: "snap-1",
            projectId,
            timestamp: new Date().toISOString(),
            branch: "main",
            lastCommitHash: "abc",
            lastCommitMessage: "init",
            lastCommitTimestamp: null,
            uncommittedCount: 0,
            uncommittedFiles: [],
        };
        service.onGitStatusChange("/test/path", first);

        const second: GitSnapshot = { ...first, lastCommitHash: "def" };
        service.onGitStatusChange("/test/path", second);

        expect(analyzeSpy.mock.calls.length).toBe(2);
    });

    test("does not trigger analysis when commit hash is unchanged", async () => {
        const service = new WardenService(db, settingsService);
        const analyzeSpy = spyOn(service, "analyzeProject").mockImplementation(
            async () => [],
        );

        const snapshot: GitSnapshot = {
            id: "snap-1",
            projectId,
            timestamp: new Date().toISOString(),
            branch: "main",
            lastCommitHash: "abc",
            lastCommitMessage: "init",
            lastCommitTimestamp: null,
            uncommittedCount: 0,
            uncommittedFiles: [],
        };

        service.onGitStatusChange("/test/path", snapshot);
        service.onGitStatusChange("/test/path", snapshot);

        expect(analyzeSpy.mock.calls.length).toBe(1);
    });

    test("blocks concurrent analysis for the same project", async () => {
        const service = new WardenService(db, settingsService);

        let resolveFetch: (value: Response) => void;
        const deferredFetch = new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        });

        mockFetch.mockImplementation(() => deferredFetch);

        const firstPromise = service.analyzeProject(projectId, false);
        const secondPromise = service.analyzeProject(projectId, false);

        const second = await secondPromise;
        expect(second.length).toBe(0);

        // @ts-expect-error
        resolveFetch(buildFetchResponse(VALID_RESPONSE));
        const first = await firstPromise;

        expect(first.length).toBe(1);

        // Reset cooldown for manual trigger test
        (
            service as unknown as { lastRunAt: Map<string, number> }
        ).lastRunAt.set(projectId, Date.now() - 61000);
        const third = await service.analyzeProject(projectId, true);
        expect(third.length).toBe(1);
    });

    test("retries on malformed AI response", async () => {
        const service = new WardenService(db, settingsService);

        mockFetch
            .mockImplementationOnce(() =>
                Promise.resolve(buildFetchResponse(INVALID_RESPONSE)),
            )
            .mockImplementationOnce(() =>
                Promise.resolve(buildFetchResponse(VALID_RESPONSE)),
            );

        const insights = await service.analyzeProject(projectId, true);

        expect(insights.length).toBe(1);
        expect(mockFetch.mock.calls.length).toBe(2);
    });

    test("handles API errors gracefully", async () => {
        const service = new WardenService(db, settingsService);

        mockFetch.mockImplementation(() =>
            Promise.resolve(buildErrorResponse(500)),
        );

        const insights = await service.analyzeProject(projectId, true);

        expect(insights.length).toBe(0);
    });
});
