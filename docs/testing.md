# Testing — trackmebaby

trackmebaby uses Bun's built-in test runner, `bun:test`. Tests are colocated with their source files using the `*.test.ts` naming convention. The suite currently includes 10 test files covering core backend services and database operations.

## Running Tests

Run the full suite or specific files using the Bun CLI:

```bash
bun test                              # Run all tests
bun test src/bun/db/database.test.ts  # Run a single test file
bun test --watch                      # Run tests in watch mode
```

## Test Coverage

| File | Scope |
|------|-------|
| `db/database.test.ts` | Schema migrations, UUIDv7 ordering, CRUD basics, settings. |
| `db/queries/chat.test.ts` | Chat history, message persistence, and JSON parsing. |
| `db/queries/vault.test.ts` | Resource management (pinning, filtering, CRUD). |
| `db/queries/warden.test.ts` | Insight persistence and status transitions. |
| `services/watcher.test.ts` | Watcher lifecycle, idempotency, and error handling. |
| `services/git-tracker.test.ts` | Git status polling and snapshot logic. |
| `services/settings.test.ts` | Settings validation, defaults, and persistence. |
| `services/warden.test.ts` | Warden service integration and analysis triggers. |
| `services/ai/context-assembler.test.ts` | Context building, time range parsing, path protection. |
| `services/autostart.test.ts` | Desktop entry management for Linux autostart. |

## Test Patterns

### Database Tests
Database tests use an in-memory SQLite instance for speed and isolation. Always run migrations before each test.

```typescript
import { Database } from "bun:sqlite";
import { describe, test, expect, beforeEach } from "bun:test";
import { runMigrations } from "../db/schema.ts";

let db: Database;
beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
});

describe("Feature", () => {
    test("performs operation", () => {
        const result = queryFunction(db, "data");
        expect(result).toBeTruthy();
    });
});
```

### Service Tests
Services often require cleanup to prevent leaks or side effects between tests. Use `afterEach` to stop watchers or clear internal state.

```typescript
let db: Database;
let service: ProjectService;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    service = new ProjectService(db);
});

afterEach(() => {
    service.stop(); // Important for services with intervals or watchers
});
```

### Filesystem Tests
Use temporary directories for tests that interact with the disk.

```typescript
import { rmSync, mkdirSync, existsSync } from "node:fs";

const TEST_DIR = "/tmp/tmb-test-dir";

beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});
```

## Conventions

1. **Imports**: Use `bun:test` for all test utilities.
2. **Isolation**: Use `:memory:` databases and temporary directories. No shared state between tests.
3. **Colocation**: Keep test files in the same directory as the source code they test.
4. **Naming**: Files must end in `.test.ts`.
5. **No Mocks**: Avoid complex mocking frameworks. Rely on in-memory implementations and real filesystem interactions in temp folders.
6. **Extensions**: Always use explicit `.ts` extensions on internal imports.
7. **Async**: Bun natively supports async/await in tests.
8. **CI**: GitHub Actions runs `bun test` on every pull request.

## Best Practices

### What to Test
- **Queries**: Verify CRUD logic, edge cases (null inputs, duplicates), and sort order.
- **Lifecycle**: Ensure services start and stop cleanly without throwing errors.
- **Parsing**: Validate that JSON round-trips preserve data types correctly.
- **Security**: Test path traversal protections in services that read from disk.

### What Not to Test
- **Frontend**: There is currently no React testing setup.
- **Electrobun APIs**: These are handled by the Electrobun runtime and are difficult to test in a pure Bun environment.
- **External APIs**: Do not call Groq or GitHub APIs in the test suite. These are considered integration points outside the scope of unit tests.

## CI Considerations

File watching tests can be flaky in CI due to filesystem timing variations. Focus on testing the registration and removal logic of watchers rather than the actual event propagation for CI-stable tests.
