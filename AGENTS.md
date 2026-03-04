# AGENTS.md — Agentic Coding Guidelines for trackmebaby

## Project Overview

A background desktop app that watches your projects folder and tracks what you're working on. Built with Electrobun, React, Tailwind CSS, and Bun.

**Stack:**
- Runtime: Electrobun (desktop shell)
- Backend: Bun (TypeScript)
- Frontend: React + Tailwind CSS + Vite
- Database: bun:sqlite (WAL mode)
- File watching: @parcel/watcher-wasm with fs.watch fallback
- AI: Groq API (LLaMA 3.3 70B)

---

## Build, Lint & Test Commands

### Install Dependencies
```bash
bun install
```

### Development
```bash
bun run dev          # Build + dev server
bun run dev:hmr     # Concurrent: HMR server + electrobun dev
bun run hmr         # Vite HMR server only (port 5173)
```

### Production Build
```bash
bun run build       # Vite build + electrobun build
bun run build:prod # Production build (--channel prod)
bun run start       # Alias for dev
```

### Testing
```bash
bun test            # Run all tests
bun test <file>    # Run single test file
bun test --watch   # Watch mode
```

Tests use Bun's built-in test runner (`bun:test`). Test files follow `*.test.ts` naming.

---

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2020
- **Strict mode:** Enabled
- **Module resolution:** bundler
- **JSX:** react-jsx
- **No unused locals/parameters:** Enforced
- **No fallthrough in switch:** Enforced

### Import Conventions

**Order (recommended):**
1. External libraries (electrobun, react, etc.)
2. Internal imports (relative paths from `./` or `../`)
3. Node.js built-ins (node:fs, node:path)

```typescript
// External
import { BrowserWindow, Tray } from "electrobun/bun";
import { useState } from "react";

// Internal (use explicit .ts extensions)
import { getDatabase } from "./db/database.ts";
import { WatcherService } from "./services/watcher.ts";

// Node built-ins
import { join } from "node:path";
import { existsSync } from "node:fs";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case | `watcher_service.ts`, `git_tracker.test.ts` |
| Classes | PascalCase | `WatcherService`, `ProjectScanner` |
| Functions/variables | camelCase | `getDatabase()`, `activeCount` |
| Interfaces/types | PascalCase | `WatcherEvent`, `ActivityEvent` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_IGNORES`, `DEV_SERVER_PORT` |
| React components | PascalCase | `App.tsx`, `TabBar.tsx` |
| CSS classes | kebab-case | `flex flex-col h-screen` |

### Formatting

- **Indentation:** 4 spaces (based on codebase)
- **Quotes:** Double quotes for strings
- **Semicolons:** Yes (enforced by TypeScript)
- **Trailing commas:** Allowed
- **Line length:** No hard limit (let Prettier/editor handle)

### Type Safety

- **Never** use `any`, `@ts-ignore`, `@ts-expect-error`
- Use explicit return types for exported functions
- Use interfaces for object shapes, types for unions/primitives

```typescript
// Good
interface WatcherEvent {
    type: "file_create" | "file_modify" | "file_delete";
    path: string;
    projectPath: string;
}

// Avoid
const event: any = ...
```

### Error Handling

- Use try/catch with meaningful error messages
- Log errors with `console.error()` including context
- Never suppress errors silently

```typescript
// Good
try {
    const project = getProjectByPath(this.db, projectPath);
    if (project) {
        insertEvent(this.db, project.id, type, filename);
    }
} catch (err: unknown) {
    console.error(`[Watcher] DB insert error:`, err instanceof Error ? err.message : err);
}

// Avoid empty catch blocks
catch { }  // NEVER
```

---

## Project Structure

```
src/
├── bun/                    # Backend (Bun process)
│   ├── index.ts            # Main entry — tray, window, service orchestration
│   ├── db/
│   │   ├── database.ts    # SQLite singleton (WAL, XDG paths)
│   │   ├── schema.ts      # Versioned migrations
│   │   └── queries.ts     # Typed CRUD with UUIDv7 keys
│   ├── rpc/
│   │   └── bridge.ts      # Electrobun typed RPC bridge
│   └── services/
│       ├── watcher.ts     # fs.watch + debounce + .gitignore filter
│       ├── git-tracker.ts # Polling git status via Bun.$
│       ├── project-scanner.ts
│       ├── settings.ts
│       └── ai/
├── mainview/              # Frontend (browser process)
│   ├── App.tsx            # Tab shell
│   ├── rpc.ts             # Frontend RPC client
│   ├── components/        # Reusable UI components
│   └── tabs/              # Tab views (CardsTab, AITab, SettingsPanel)
└── shared/                # Shared types (both processes)
    ├── types.ts           # Domain types
    └── rpc-types.ts       # Electrobun RPC schema
```

---

## Testing Guidelines

- Test files: `*.test.ts` in same directory as source
- Use `bun:test` (describe, test, expect, beforeEach, afterEach)
- Tests should be isolated; clean up resources in afterEach
- Use in-memory SQLite (`:memory:`) for database tests

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { WatcherService } from "./watcher.ts";

let db: Database;
let watcher: WatcherService;

beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    watcher = new WatcherService(db, 100);
});

afterEach(() => {
    watcher.stopAll();
});
```

---

## Database Conventions

- Use `bun:sqlite` with WAL mode enabled
- Primary keys: UUIDv7 (time-sortable, globally unique)
- Migrations: Versioned in `schema.ts` via `runMigrations()`
- Query functions: Typed, in `db/queries.ts`
- Database singleton: `getDatabase()` in `db/database.ts`

---

## Frontend Guidelines (React + Tailwind)

- Use functional components with hooks
- Tailwind classes: prefer utility-first
- Component files: `*.tsx` extension
- Colocate styles with components (inline Tailwind)
- Use TypeScript for all props

---

## Common Patterns

### Service Classes
Services are classes that encapsulate business logic:
```typescript
export class WatcherService {
    private watchers: Map<string, WatcherInstance> = new Map();
    private debounceMs: number;
    
    constructor(db: Database, debounceMs: number = 500) {
        this.db = db;
        this.debounceMs = debounceMs;
    }
}
```

### Event Callbacks
```typescript
type EventCallback = (event: WatcherEvent) => void;

onEvent(callback: EventCallback): void {
    this.callbacks.push(callback);
}
```

### RPC Bridge
Frontend communicates with backend via Electrobun RPC:
- Backend defines RPC handlers in `bun/rpc/bridge.ts`
- Frontend calls via `rpc.ts` client

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/bun/index.ts` | App entry point, tray, window management |
| `src/bun/db/database.ts` | SQLite singleton |
| `src/bun/db/schema.ts` | Database migrations |
| `src/bun/services/watcher.ts` | File change monitoring |
| `src/bun/services/git-tracker.ts` | Git status polling |
| `src/mainview/App.tsx` | Main React app shell |
| `src/shared/types.ts` | Shared TypeScript interfaces |

---

---

## Design System & Theming (Semantic Tokens)

The application uses a **Hybrid Token System** with CSS Variables (HSL) as the source of truth, mapped to Tailwind utility classes. This ensures a single source of truth and allows for high-performance theme switching.

### 1. Token Naming Convention
Tokens follow the `app-` prefix to be platform-agnostic. Use these tokens instead of raw Tailwind colors (e.g., zinc, slate) for UI elements.

| Token | Purpose |
| :--- | :--- |
| `app-bg` | Core window background |
| `app-surface` | Primary cards and panels |
| `app-surface-elevated` | Secondary panels and inputs |
| `app-text-main` | Primary readable content |
| `app-text-muted` | Labels, timestamps, secondary text |
| `app-border` | Default separators and outlines |
| `app-accent` | Brand color (default orange) |
| `app-hover` | Interaction highlights |

### 2. Implementation Rules (MUST DO)
- **Never use `dark:` prefix** for semantic roles. The CSS variables automatically change values when the `.dark` class is applied to the root.
- **Use Tailwind Bridge**: Map all new semantic variables in `tailwind.theme.mjs` using the HSL pattern: `hsl(var(--token) / <alpha-value>)`. This enables Tailwind's opacity modifiers (e.g., `bg-app-accent/50`).
- **No raw colors**: Avoid using raw Tailwind colors like `bg-zinc-800` for structural elements. Use `bg-app-surface` instead.
- **Instant Swaps**: Use the `.theme-switching` guard class to suppress transitions during theme toggles to avoid ghosting.
- **Accessibility**: Support High Contrast mode via the `@media (forced-colors: active)` block in `index.css`.
- **FOUC Prevention**: Ensure the theme-detection script remains at the top of `index.html`.

---
## Gotchas

1. **Parcel watcher fallback:** `@parcel/watcher-wasm` may fail in some environments; code gracefully falls back to `fs.watch`
2. **Database path:** In Electrobun, use `Utils.paths.userData` for app-scoped storage
3. **UUIDv7:** Use for all primary keys (time-sortable IDs)
4. **Bun.$:** Use for read-only shell commands (git, etc.)
5. **No SDKs:** AI providers use fetch-based implementation, not npm SDKs
