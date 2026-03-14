# AGENTS.md — Agentic Coding Guidelines for trackmebaby

## Project Overview

A background desktop app that watches your projects folder and tracks what you're working on. Built with Electrobun, React, Tailwind CSS, and Bun.

**Stack:** Electrobun | Bun | React + Tailwind + Vite | bun:sqlite | @parcel/watcher-wasm | Groq API (LLaMA 3.3 70B)

---

## Build, Lint & Test Commands

### Install
```bash
bun install
```

### Development
```bash
bun run dev          # Build + dev server
bun run dev:ui      # Vite HMR only (port 5173)
bun run dev:native  # Electrobun dev with --watch
```

### Production
```bash
bun run build       # Vite + electrobun build
bun run build:prod # Production (--env=stable)
bun run start       # Alias for dev
```

### Lint & Typecheck
```bash
bun run lint        # biome check .
bun run format      # biome format .
bun run typecheck   # tsc --noEmit
```

### Testing
```bash
bun test            # Run all tests
bun test <file>    # Run single test file
bun test --watch   # Watch mode
```
Tests use `bun:test` with `*.test.ts` naming in same directory as source.

---

## Code Style Guidelines

### TypeScript Configuration
- **Target:** ES2020 | **Strict:** Yes | **Module:** ESNext (bundler)
- **JSX:** react-jsx | **No unused locals/params** | **No fallthrough in switch**

### Import Order (flexible)
- External libs first (electrobun, react)
- Internal imports (frontend may omit `.ts` extensions)
- Node.js built-ins (`node:path`, `node:fs`) - can be mixed with internal imports

```typescript
// Backend (explicit .ts)
import { getDatabase } from "./db/database.ts";
import { join } from "node:path";

// Frontend (omit .ts)
import { useState } from "react";
import { getSettings } from "./settings";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `git-tracker.ts`, `link-preview.ts` |
| Classes | PascalCase | `WatcherService` |
| Functions/variables | camelCase | `getDatabase()`, `activeCount` |
| Interfaces/types | PascalCase | `WatcherEvent` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_IGNORES` |
| React components | PascalCase | `App.tsx` |

### Formatting (Biome)
- **Indent:** 4 spaces | **Quotes:** Double | **Semicolons:** Always | **Trailing commas:** All

### Type Safety
- **Never** use `any`, `@ts-ignore`, `@ts-expect-error`
- Use explicit return types for exported functions
- Use interfaces for objects, types for unions/primitives

### Error Handling
- Try/catch with meaningful error messages
- Log with `console.error()` including context
- Never suppress errors silently

---

## Project Structure

```
src/
├── bun/                    # Backend (Bun process)
│   ├── index.ts            # Entry: tray, window, services
│   ├── db/                 # SQLite (WAL mode)
│   │   ├── database.ts    # Singleton via getDatabase()
│   │   ├── schema.ts      # Migrations
│   │   └── queries.ts     # Typed CRUD, UUIDv7 keys
│   ├── rpc/bridge.ts       # Electrobun RPC handlers
│   └── services/           # watcher, git-tracker, project-scanner, warden, github, settings, ai, autostart, link-preview
├── mainview/               # Frontend (React)
│   ├── App.tsx            # Tab shell
│   ├── rpc.ts             # Frontend RPC client
│   ├── components/        # TabBar, ProjectCard
│   └── tabs/              # CardsTab, AITab, SettingsPanel
└── shared/                # Shared types
    ├── types.ts           # Domain types
    └── rpc-types.ts       # RPC schema
```

---

## Database Conventions

- Use `bun:sqlite` with WAL mode
- Primary keys: UUIDv7 (time-sortable)
- Migrations via `runMigrations()` in `schema.ts`
- Query functions in `db/queries.ts`
- Use `getDatabase()` singleton

---

## Frontend Guidelines (React + Tailwind)

- Functional components with hooks
- Tailwind utility-first; use semantic tokens (`app-bg`, `app-surface`, `app-accent`, etc.)
- Never use raw Tailwind colors for structural elements
- Component files: `*.tsx`

### Semantic Tokens
| Token | Purpose |
|-------|---------|
| `app-bg` | Window background |
| `app-surface` | Primary cards/panels |
| `app-text-main` | Primary content |
| `app-text-muted` | Labels, timestamps |
| `app-accent` | Brand color |
| `app-hover` | Interaction highlights |

---

## Key Patterns

### Service Class
```typescript
export class WatcherService {
    private watchers = new Map<string, WatcherInstance>();
    constructor(private db: Database, private debounceMs = 500) {}
}
```

### Event Callback
```typescript
type EventCallback = (event: WatcherEvent) => void;
onEvent(callback: EventCallback): void { this.callbacks.push(callback); }
```

### RPC Bridge
- Backend: handlers in `bun/rpc/bridge.ts`
- Frontend: calls via `rpc.ts` client

---

## Gotchas

1. **Parcel watcher fallback:** `@parcel/watcher-wasm` may fail → graceful `fs.watch` fallback
2. **Database path:** Use `Utils.paths.userData` for app-scoped storage
3. **UUIDv7:** Use for all primary keys
4. **Bun.$:** Use for read-only shell commands (git)
5. **No SDKs:** AI uses fetch-based implementation, not npm SDKs

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/bun/index.ts` | App entry, tray, window |
| `src/bun/db/database.ts` | SQLite singleton |
| `src/bun/services/watcher.ts` | File monitoring |
| `src/bun/services/git-tracker.ts` | Git status polling |
| `src/mainview/App.tsx` | React shell |
| `src/shared/types.ts` | Shared interfaces |
