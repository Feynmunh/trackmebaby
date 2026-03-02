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

let db: Database;
let projectId: string;
let getSettingValue: string | null = null;
let originalFetch: typeof fetch;
let originalNow: typeof Date.now;

let mockGetSetting: ReturnType<typeof mock>;
let mockInsertWardenInsight: ReturnType<typeof mock>;
let mockFetch: ReturnType<typeof mock>;

let WardenService: typeof import("./warden.ts").WardenService;

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
        json: () =>
            Promise.resolve({
                choices: [{ message: { content } }],
            }),
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

    getSettingValue = "test-key";
    originalFetch = globalThis.fetch;
    originalNow = Date.now;
    mockFetch = createMockFetch(VALID_RESPONSE);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await setupModuleMocks();
});

afterEach(() => {
    // Restore all spies
    mockGetSetting?.mockRestore?.();
    mockInsertWardenInsight?.mockRestore?.();

    mock.restore();
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    db.close();
});

describe("WardenService", () => {
    test("skips analysis within cooldown window", async () => {
        const service = new WardenService(db);

        const first = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );
        const second = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(first.length).toBe(1);
        expect(second.length).toBe(0);
        expect(mockFetch.mock.calls.length).toBe(1);
    });

    test("runs analysis after cooldown expires", async () => {
        let now = 1_000_000;
        Date.now = mock(() => now);

        const service = new WardenService(db);
        await service.analyzeProject(projectId, "/test/path", false);

        now += 6 * 60 * 1000;
        const second = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(second.length).toBe(1);
        expect(mockFetch.mock.calls.length).toBe(2);
    });

    test("manual trigger bypasses cooldown", async () => {
        const service = new WardenService(db);

        await service.analyzeProject(projectId, "/test/path", false);
        const second = await service.analyzeProject(
            projectId,
            "/test/path",
            true,
        );

        expect(second.length).toBe(1);
        expect(mockFetch.mock.calls.length).toBe(2);
    });

    test("skips analysis when API key is missing", async () => {
        getSettingValue = null;
        const service = new WardenService(db);

        const result = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(result.length).toBe(0);
    });

    test("does not call fetch when API key is missing", async () => {
        getSettingValue = null;
        const service = new WardenService(db);

        await service.analyzeProject(projectId, "/test/path", false);

        expect(mockFetch.mock.calls.length).toBe(0);
    });

    test("triggers analysis when commit hash changes", async () => {
        const service = new WardenService(db);
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
        const service = new WardenService(db);
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

    test("parses valid JSON and inserts insights", async () => {
        mockFetch.mockImplementation(
            (input: RequestInfo | URL, init?: RequestInit) => {
                void input;
                void init;
                return Promise.resolve(buildFetchResponse(VALID_RESPONSE));
            },
        );

        const service = new WardenService(db);
        const result = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(result.length).toBe(1);
        expect(mockInsertWardenInsight.mock.calls.length).toBe(1);
    });

    test("returns empty array for invalid JSON and avoids inserts", async () => {
        mockFetch.mockImplementation(
            (input: RequestInfo | URL, init?: RequestInit) => {
                void input;
                void init;
                return Promise.resolve(buildFetchResponse(INVALID_RESPONSE));
            },
        );

        const service = new WardenService(db);
        const result = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(result.length).toBe(0);
        expect(mockInsertWardenInsight.mock.calls.length).toBe(0);
    });

    test("blocks concurrent analysis for the same project", async () => {
        let resolveFetch: (value: Response) => void = () => undefined;
        const fetchPromise = new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        });
        mockFetch.mockImplementation(
            (input: RequestInfo | URL, init?: RequestInit) => {
                void input;
                void init;
                return fetchPromise;
            },
        );

        const service = new WardenService(db);
        const firstPromise = service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );
        const second = await service.analyzeProject(
            projectId,
            "/test/path",
            false,
        );

        expect(second.length).toBe(0);

        resolveFetch(buildFetchResponse(VALID_RESPONSE));
        const first = await firstPromise;

        expect(first.length).toBe(1);

        const third = await service.analyzeProject(
            projectId,
            "/test/path",
            true,
        );
        expect(third.length).toBe(1);
    });
});
