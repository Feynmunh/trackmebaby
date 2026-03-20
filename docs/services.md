# Backend Services — trackmebaby

All backend services in trackmebaby are located in `src/bun/services/`. Most are implemented as TypeScript classes using constructor dependency injection. A few are standalone functions (e.g., link preview).

## Service Overview

| Service | File | Purpose |
| :--- | :--- | :--- |
| WatcherService | watcher.ts | Monitors project directories for file changes |
| GitTrackerService | git-tracker.ts | Polls git status periodically using shell commands |
| ProjectScanner | project-scanner.ts | Discovers git repositories in a base folder |
| WardenService | warden.ts | Provides AI-powered code health analysis and insights |
| SettingsService | settings.ts | Manages typed application settings stored in SQLite |
| SecretStore | secret-store.ts | Secure credential storage using OS keychain with SQLite fallback |
| GitHubService | github.ts | Handles GitHub API integration, issues, and PRs |
| AutostartService | autostart.ts | Manages OS autostart registration |
| WindowsTitlebar | windows-titlebar.ts | Windows-only native titlebar dark/light mode sync |
| linkPreview (function) | link-preview.ts | Fetches URL metadata for previews |
| runGit (function) | git-command.ts | Executes git commands with timeout and logging |
| getUncommittedFileStatus (function) | git-utils.ts | Retrieves uncommitted file list with mtimes |

### Subdirectories

| Directory | Purpose |
| :--- | :--- |
| `ai/` | AI provider implementations (Groq, Gemini), context assembly, Warden prompts |
| `git-tracker/` | Git tracker submodules: `commands.ts` for shell execution, `parsers.ts` for output handling |
| `github/` | GitHub integration: `api.ts` for network calls, `oauth.ts` for device flow auth |

## Service Details

### WatcherService(db, debounceMs=500)

The WatcherService monitors file system events within tracked projects.

- Uses `@parcel/watcher-wasm` for efficient watching, with a fallback to a manual recursive `fs.watch` implementation.
- Events are debounced per file path to avoid spamming the database during rapid changes.
- Respects `.gitignore` files and a hardcoded `DEFAULT_IGNORES` list.
- Supported events: `file_create`, `file_modify`, and `file_delete`.
- Persists events to the SQLite `events` table via `insertEvent()`.
- Provides an `onEvent(callback)` method for other parts of the app to react to changes.
- Key methods: `addProject(path)`, `removeProject(path)`, `stopAll()`, and the `activeCount` getter.

### GitTrackerService(db, pollIntervalMs=60000)

This service tracks the state of git repositories without modifying them.

- Polls git status using `Bun.$` shell commands for a read-only integration.
- Tracks current branch, last commit details (hash, message, timestamp), and uncommitted file counts.
- Stores state snapshots in the `git_snapshots` table.
- Detects git worktrees to provide a complete view of project activity.
- Internal logic is split into modules: `git-tracker/commands.ts` for shell execution and `git-tracker/parsers.ts` for output handling.

### ProjectScanner(db)

The ProjectScanner helps users find and add their projects to the application.

- Scans a base directory for directories containing a `.git` folder or file.
- Limits recursion to a maximum depth of 3 to maintain performance.
- Detects git worktrees and associates them with the parent repository.
- Automatically upserts discovered projects into the database.
- Returns an array of `Project` objects including detected worktree information.

### WardenService(db, settingsService, onInsights, onFailure)

Warden provides AI-powered analysis of project activity and health.

- Assembles activity context (file events and git snapshots) via `warden-context.ts`.
- Sends context to an AI provider using structured prompts defined in `warden-prompt.ts`.
- Parses AI responses into `WardenInsight` objects and stores them in the database.
- Insights include a severity level (critical, warning, or info) and a category.
- Categories include: `security`, `tech_debt`, `project_health`, `suggestion`, `testing_gap`, `deprecation`, `dependency`, and `refactoring`.
- Analysis is triggered when a project is viewed or manually requested.

### SettingsService(db)

A simple wrapper for managing application configuration.

- Provides a typed interface for settings stored as key-value pairs in SQLite.
- Default values: `aiProvider="groq"`, `pollInterval=60000ms`, `watchDebounce=500ms`.
- Enforces validation: `pollInterval` minimum is 30s, `watchDebounce` minimum is 100ms.
- Key methods: `getAll()`, `getBasePath()`, `getPollInterval()`, `getWatchDebounce()`, and `updateMany(partial)`.

### GitHubService(db)

Integrates GitHub data into the project dashboard.

- Implements GitHub OAuth Device Flow for authentication (no redirect server needed).
- Fetches open issues and pull requests for projects with a GitHub remote.
- Uses ETag-based caching to minimize API usage and respect rate limits.
- Core logic resides in the `github/` subdirectory, with `api.ts` for network calls and `oauth.ts` for authentication.

### AutostartService()

Manages OS-level autostart registration.

- Allows the app to start automatically when the user logs in.
- Platform-specific implementations for Linux, macOS, and Windows.
- Uses platform-appropriate autostart mechanisms (launch agents, registry, etc.).

### SecretStore(db, options)

Manages secure credential storage across platforms.

- Uses `bun:secrets` API for OS keychain access (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- Falls back to encrypted SQLite storage when keychain is unavailable.
- Caches keychain availability with a configurable TTL (default 30s) to avoid repeated probes.
- Provides `storeSecret()`, `getSecret()`, and `deleteSecret()` methods.
- Used by the AI integration to store API keys securely.

### WindowsTitlebar (windows-titlebar.ts)

Windows-only service for native titlebar appearance control.

- Uses PowerShell .NET interop to call the DWM (Desktop Window Manager) API.
- Applies dark or light mode to the native title bar to match the app theme.
- Supports Windows 10 20H1+ and Windows 11.
- All exports are no-ops on non-Windows platforms.
- Sets the window icon from bundled assets (`.ico` or `.png`).

### runGit(command, options)

A helper function for executing git commands via `Bun.spawn()`.

- Supports timeout (default 8s) with `AbortController`.
- Logs command execution with configurable log levels.
- Returns `null` on error or timeout instead of throwing.
- Used by `git-tracker.ts` and `git-utils.ts`.

### getUncommittedFileStatus(projectPath, label)

Retrieves the list of uncommitted files with their modification times.

- Runs `git status --porcelain` to get file list.
- Parses output using `parseGitStatusPorcelain()` from shared utilities.
- Returns file paths, latest mtime, and per-file mtime map.

### Subdirectory: ai/

The `ai/` subdirectory contains all AI provider logic:

| File | Purpose |
| :--- | :--- |
| `provider.ts` | `AIProvider` interface definition |
| `groq-provider.ts` | Groq API implementation (fetch-based) |
| `gemini-provider.ts` | Google Gemini implementation (fetch-based) |
| `index.ts` | Provider factory + API key helpers |
| `config.ts` | Environment variable helpers |
| `context-assembler.ts` | Builds activity context for chat queries |
| `warden-context.ts` | Builds context for Warden analysis |
| `warden-prompt.ts` | Warden system prompt + JSON response parser |
| `secret-store.ts` | AI-specific secret store instance |

### Subdirectory: git-tracker/

The `git-tracker/` subdirectory splits GitTrackerService internals:

| File | Purpose |
| :--- | :--- |
| `commands.ts` | Shell command execution for git operations |
| `parsers.ts` | Output parsing for git status, log, and diff |
| `index.ts` | Re-exports for backward compatibility |

### Subdirectory: github/

The `github/` subdirectory handles GitHub integration:

| File | Purpose |
| :--- | :--- |
| `api.ts` | GitHub REST API calls with ETag caching |
| `oauth.ts` | GitHub OAuth Device Flow implementation |
| `index.ts` | Re-exports for backward compatibility |

## Service Pattern

Every service follows a consistent constructor dependency injection pattern to ensure they are easy to test and initialize.

```typescript
export class ServiceName {
    private db: Database;
    
    constructor(db: Database, ...config) {
        this.db = db;
        // initialize other config values
    }
}
```
