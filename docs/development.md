# Development Guide - trackmebaby

This guide provides instructions for setting up the development environment and contributing to the project.

## Prerequisites

You need the following tools installed on your system.

- Bun 1.3 or higher
- Git

## Installation

First, clone the repository and install the dependencies.

```bash
bun install
```

## Development Commands

Use these commands to run and verify your changes.

| Command | What it does |
|:---|:---|
| `bun run dev` | Builds electrobun and runs concurrent UI and native dev servers |
| `bun run dev:ui` | Starts the Vite HMR dev server only (port 5173) |
| `bun run dev:native` | Runs the Electrobun dev server with --watch enabled |
| `bun run build` | Performs both Vite build and electrobun build |
| `bun run build:prod` | Creates a production build using the prod channel |
| `bun run lint` | Runs Biome to check linting and formatting |
| `bun run format` | Uses Biome to format all source files |
| `bun run typecheck` | Executes tsc to verify types without emitting files |
| `bun test` | Runs the full test suite using bun:test |
| `bun test path/to/file.test.ts` | Runs a specific test file |
| `bun test --watch` | Runs tests in watch mode for active development |

## CI Pipeline

GitHub Actions executes the following steps on every pull request or push to the master branch.

1. Checkout the source code.
2. Set up Bun 1.3.x environment.
3. Install dependencies using a frozen lockfile.
4. Run the linting check.
5. Verify TypeScript types.
6. Run all automated tests.
7. Attempt a full build to ensure project integrity.

## Environment Variables

The application uses these variables for configuration.

| Variable | Purpose |
|:---|:---|
| `GROQ_API_KEY` | Primary API key for the Groq AI provider |
| `AI_API_KEY` | Fallback API key for AI services |
| `XDG_DATA_HOME` | Overrides the default data directory (defaults to ~/.local/share) |

## Database Location

The SQLite database location depends on the execution environment. When running through Electrobun, it uses `Utils.paths.userData`. Standalone or test environments use `XDG_DATA_HOME/trackmebaby/trackmebaby.db`.

## HMR Workflow

For frontend-only changes, run `bun run dev:ui` to get hot module replacement in the browser. Changes to the Bun process or RPC bridge require running `bun run dev`, which rebuilds the Electrobun shell.

## PR Checklist

Before submitting a pull request, ensure these requirements are met.

1. `bun run lint` passes without warnings.
2. `bun run typecheck` shows no errors.
3. `bun test` passes all test cases.
4. If shared types changed, you've updated both backend handlers and frontend consumers.
5. Include a summary of any contract changes in the pull request description.

## Electrobun Configuration

The `electrobun.config.ts` file manages app metadata and build rules. It includes a specific watch list for Linux users. Recursive watching has limitations on Linux, so all subdirectories in `src/bun` and `src/shared` are explicitly listed.

Copy rules in the config file move Vite artifacts from the `dist/` directory into the final app structure. This ensures the frontend views are correctly bundled with the native process.
