# Architecture - trackmebaby

trackmebaby is a desktop application built with Electrobun. It uses a two-process model to handle background tasks and user interface rendering.

## Overview

Unlike Electron, Electrobun uses Bun for its backend process. This allows for fast startup times and native integration with Bun's APIs. The application runs as a background daemon with a system tray icon.

## Process Model

The application splits responsibilities between two main processes.

### Bun Process
The Bun process handles the core business logic and system integration. It runs various services like the project watcher, git tracker, and project scanner. It manages the SQLite database using `bun:sqlite` and controls the system tray icon.

### Browser Process
The browser process runs a React application styled with Tailwind CSS. This UI is rendered within Electrobun's webview. It communicates with the Bun process to display project activity and allow user interaction.

### Communication
A typed RPC bridge connects the two processes. This bridge is defined using Electrobun's `BrowserView.defineRPC()`, ensuring type safety across the process boundary.

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│ Electrobun Shell                             │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Bun Process      │  │ Browser Process  │ │
│  │  Services         │↔│  React + Tailwind│ │
│  │  SQLite DB        │  │  Feature modules │ │
│  │  System Tray      │  │  RPC client      │ │
│  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────┘
```

## Boot Sequence

The application starts through `index.ts` and follows this initialization path.

1. `getDatabase`: Opens the SQLite database from the user data directory.
2. Initialize Services: Creates instances of `SettingsService`, `ProjectScanner`, `WatcherService`, `GitTrackerService`, and `WardenService`.
3. `createRPC`: Sets up the RPC bridge and injects service dependencies.
4. `Tray`: Creates the system tray icon and sets up its menu.
5. `startServices`: Scans projects, attaches file watchers, and starts git tracking.
6. `createWindow`: Opens the main dashboard window.

## Data Flow

### File Watching
The `ProjectScanner` finds git repositories in the configured base folder. The `WatcherService` then monitors each project for changes. Events are debounced and filtered through `.gitignore` rules before being stored in SQLite and pushed to the frontend via RPC.

### Git Tracking
The `GitTrackerService` polls the status of all tracked projects every 60 seconds. It captures snapshots of branches, commits, and uncommitted files. These snapshots are saved to the database and updated on the UI.

### AI Chat
When a user sends a message, the `ContextAssembler` builds a prompt using recent activity and git snapshots. This context is sent to the Groq API via fetch. The resulting response is stored in the chat history and returned to the user.

### Warden Analysis
Warden analysis triggers when a user views a project. The system gathers project context and sends it for AI analysis. Insights are stored in the database and pushed to the frontend to provide immediate project feedback.

## Service Dependency Graph

The `index.ts` entry point orchestrates the lifecycle of all services.

- `index.ts` creates all services and injects the database singleton.
- The RPC bridge receives service instances to create feature-specific registrars.
- Feature registrars include: ai, git, github, projects, settings, system, vault, warden, and window.

## Directory Layout

```
src/
├── bun/                   # Backend (Bun process)
│   ├── index.ts           # Entry: tray, window, service orchestration
│   ├── db/                # SQLite: database.ts, schema.ts, queries/
│   ├── rpc/               # Electrobun RPC bridge + feature registrars
│   └── services/          # Business logic: watcher, git-tracker, etc.
├── mainview/              # Frontend (browser process)
│   ├── App.tsx            # Tab shell with AI sidebar
│   ├── rpc.ts             # Frontend RPC client
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature-specific modules
│   ├── hooks/             # Custom React hooks
│   └── tabs/              # Main tab views
└── shared/                # Shared types for both processes
    ├── types.ts           # Domain types
    └── rpc-types.ts       # Electrobun RPC contract
```
