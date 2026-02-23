# trackmebaby

A background desktop app that watches your projects folder and keeps track of what you're working on. Ask AI questions about your work history.

## Stack

| Layer | Tech |
|-------|------|
| Runtime | [Electrobun](https://electrobun.dev/) (not Electron) |
| Backend | [Bun](https://bun.sh/) (TypeScript) |
| Frontend | React + Tailwind CSS + Vite |
| Database | bun:sqlite (WAL mode) |
| File watching | `@parcel/watcher-wasm` with `fs.watch` fallback |
| Git tracking | `Bun.$` shell (read-only git commands) |
| AI | Groq API (LLaMA 3.3 70B, OpenAI-compatible) |

## Architecture

```
src/
├── bun/                    # Backend (Bun process)
│   ├── index.ts            # Main entry — tray, window, service orchestration
│   ├── db/
│   │   ├── database.ts     # SQLite singleton (WAL, XDG paths)
│   │   ├── schema.ts       # Versioned migrations
│   │   └── queries.ts      # Typed CRUD with UUIDv7 keys
│   ├── rpc/
│   │   └── bridge.ts       # Electrobun typed RPC bridge
│   └── services/
│       ├── watcher.ts      # fs.watch + debounce + .gitignore filter
│       ├── git-tracker.ts  # Polling git status via Bun.$
│       ├── project-scanner.ts  # Auto-detect git repos (max depth 3)
│       ├── settings.ts     # Typed settings over SQLite
│       └── ai/
│           ├── provider.ts       # Provider interface
│           ├── groq-provider.ts  # Groq implementation (fetch-based)
│           ├── context-assembler.ts  # Build activity context for AI
│           └── index.ts          # Provider factory
├── mainview/               # Frontend (browser process)
│   ├── App.tsx             # Tab shell (Projects, AI, Settings)
│   ├── rpc.ts              # Frontend RPC client
│   ├── components/
│   │   ├── TabBar.tsx      # Bottom navigation
│   │   └── ProjectCard.tsx # Project activity card
│   └── tabs/
│       ├── CardsTab.tsx    # Project cards grid
│       ├── AITab.tsx       # AI chat interface
│       └── SettingsPanel.tsx  # Configuration form
└── shared/                 # Shared types (both processes)
    ├── types.ts            # Domain types
    └── rpc-types.ts        # Electrobun RPC schema
```

## How it works

1. **Background daemon**: Runs in system tray. Click to open dashboard.
2. **Project scanner**: Scans your base folder for git repos (depth 3).
3. **File watcher**: Monitors each project via `@parcel/watcher-wasm` (or `fs.watch` fallback) with debouncing and `.gitignore` filtering.
4. **Git tracker**: Polls git status (branch, commits, uncommitted files) every 60s.
5. **AI chat**: Ask questions about your work — activity context is assembled automatically.

## Development

```bash
# Install dependencies
bun install

# Development (build + dev server)
bun run dev

# Development with HMR
bun run dev:hmr

# Production build
bun run build:prod
```

## Configuration

Set your projects folder in Settings, or via environment variable:

```bash
export GROQ_API_KEY="your-api-key-here"
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
│ `@parcel/watcher-wasm` with `fs.watch` fallback │ Parcel watcher has napi-wasm incompatibility in Bun test env — graceful fallback │
| `Bun.$` over `simple-git` | Zero deps, read-only shell commands |
| UUIDv7 over autoincrement | Time-sortable, globally unique |
| Fetch-based AI over SDKs | No npm dependency, works with any OpenAI-compatible API |
