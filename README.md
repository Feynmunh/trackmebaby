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
| AI | Groq API (LLaMA 3.3 70B) + Google Gemini |
| Auth | GitHub OAuth Device Flow |

## Architecture

```
src/
├── bun/                         # Backend (Bun process)
│   ├── index.ts                 # Main entry — tray, window, service orchestration
│   ├── db/
│   │   ├── database.ts         # SQLite singleton (WAL, XDG paths)
│   │   ├── schema.ts           # Versioned migrations
│   │   └── queries/            # Typed CRUD with UUIDv7 keys
│   │       ├── activity.ts     # Activity tracking
│   │       ├── chat.ts         # AI chat history
│   │       ├── events.ts       # File events
│   │       ├── git.ts          # Git metadata
│   │       ├── project-cache.ts # Cached project metadata
│   │       ├── projects.ts     # Projects
│   │       ├── settings.ts     # App settings
│   │       ├── todos.ts        # Todo items
│   │       ├── vault.ts        # Encrypted vault
│   │       └── warden.ts        # Warden AI insights
│   ├── rpc/
│   │   ├── bridge.ts            # Electrobun typed RPC bridge
│   │   └── features/           # RPC handlers by feature
│   │       ├── ai/             # AI chat
│   │       ├── github/         # GitHub integration
│   │       ├── git/            # Git operations
│   │       ├── projects/       # Project management
│   │       ├── settings/       # Settings
│   │       ├── vault/          # Encrypted vault
│   │       ├── warden/         # Warden AI insights
│   │       └── window/         # Window controls
│   └── services/
│       ├── ai/                 # AI providers (Groq, Gemini)
│       ├── autostart.ts        # OS autostart
│       ├── github.ts           # GitHub API
│       ├── git-tracker.ts      # Git status polling
│       ├── link-preview.ts     # URL metadata
│       ├── project-scanner.ts  # Find git repos
│       ├── settings.ts         # Settings
│       └── watcher.ts          # File watching
├── mainview/                    # Frontend (browser)
│   ├── App.tsx                 # Tab shell
│   ├── rpc.ts                  # RPC client
│   ├── components/            # UI components
│   ├── features/              # Feature hooks/views
│   │   ├── github/            # GitHub UI
│   │   └── vault/             # Vault UI
│   ├── hooks/                 # React hooks
│   └── tabs/                  # Tab views
└── shared/                      # Shared types
    ├── types.ts               # Domain types
    ├── rpc-types.ts           # RPC schema
    ├── error.ts               # Error classes
    ├── git.ts                 # Git utilities
    ├── logger.ts              # Logging
    └── time.ts                # Time utilities
```

## How it works

1. **Background daemon**: Runs in system tray. Click to open dashboard.
2. **Project scanner**: Scans your base folder for git repos (depth 3).
3. **File watcher**: Monitors each project via `@parcel/watcher-wasm` (or `fs.watch` fallback) with debouncing and `.gitignore` filtering.
4. **Git tracker**: Polls git status (branch, commits, uncommitted files) every 60s.
5. **AI chat**: Ask questions about your work — activity context is assembled automatically.
6. **Warden**: AI-powered insights that analyze your work patterns and provide recommendations.
7. **GitHub integration**: Sign in with GitHub to view issues and PRs for your projects.

## Installation

Download the latest version for your platform from the [Releases](https://github.com/Feynmunh/trackmebaby/releases) page.

- **Linux:** Download the `.tar.gz` installer, extract it, and run the `installer` file.
- **macOS:** Download the `.tar.gz`, extract it, then drag/move the `trackmebaby.app` into your Applications folder. (Note: Since this is an unsigned app, you may need to Right-click -> Open the first time).
- **Windows:** Download the setup executable and run it to install.

### Linux Post-Install

On Linux, the app creates a Desktop shortcut but does not automatically appear in the app menu. This is a [known electrobun issue](https://github.com/blackboardsh/electrobun/issues/144).

**Option 1:** After rebuilding with an icon (see below), the desktop file will be in the app directory:

```bash
mkdir -p ~/.local/share/applications
cp ~/.local/share/dev.trackmebaby.app/stable/app/trackmebaby.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

**Option 2:** Right-click the Desktop shortcut → "Allow Launching" — then search for it in your app menu.

### Building with Icon (Linux)

To include an icon in the Linux build (required for the desktop file to be generated):

1. Add an icon to `build/icon.png` (512x512 PNG recommended)
2. The config at `electrobun.static.config.ts` already includes `linux.icon: "build/icon.png"`
3. Rebuild: `bun run build:prod`

## Development

```bash
# Install dependencies
bun install

# Development (build + dev server)
bun run dev

# Development with HMR (concurrent UI + native)
bun run dev:ui      # Vite HMR only (port 5173)
bun run dev:native  # Electrobun dev with --watch

# Production build
bun run build:prod

# Lint & format
bun run lint         # biome check .
bun run format       # biome format .

# Type check
bun run typecheck    # tsc --noEmit

# Run tests
bun test             # Run all tests
bun test <file>     # Run single test file
bun test --watch    # Watch mode
```

## Configuration

Set your projects folder in the Settings panel, or configure AI providers via environment variables:

```bash
export GROQ_API_KEY="your-api-key-here"
export GEMINI_API_KEY="your-gemini-key-here"
```
