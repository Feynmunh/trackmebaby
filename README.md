<div align="center">

# trackmebaby

[![Build Status](https://github.com/Feynmunh/trackmebaby/actions/workflows/ci.yml/badge.svg)](https://github.com/Feynmunh/trackmebaby/actions)
[![Latest Release](https://img.shields.io/github/v/tag/Feynmunh/trackmebaby?label=release)](https://github.com/Feynmunh/trackmebaby/releases)

</div>

**The Project Manager Every Dev Wants**

trackmebaby is a lightweight desktop app that quietly watches your projects folder to build a rich history of your work. Say goodbye 👋 to manually opening and closing todos, forgetting where you left off, and maintaining a separate Notion page just to jot things down related to your project.

> [!IMPORTANT]
> **trackmebaby v1.0 is coming soon!** We're working on the final release features. Stay tuned for the official launch.

---

## Key Features

### Automatic Activity Tracking
Forget manual time-tracking or "What was I doing yesterday?" moments.
- **File Watching**: Monitors every change in your projects folder (respecting .gitignore).
- **Git Context**: Automatically tracks branches, commits, and uncommitted changes across all your repositories.

### Warden: Your AI Project Health Officer
Warden analyzes your recent activity to provide proactive insights and actionable tasks.
- **Smart Todos**: Suggests hyper-specific next steps based on what you're currently building.
- **Auto-Completion**: Automatically marks tasks as complete by analyzing your git diffs.
- **Health Insights**: Identifies tech debt, security gaps, and project health issues.

### Resource Vault
Keep all your project-related knowledge in one place.
- **Project-Specific Storage**: Save links, notes, and code snippets attached to specific projects.
- **Rich Link Previews**: Automatically fetches titles, descriptions, and icons for any URL you save.
- **Organization**: Use tags and pinning to keep your most important resources easily accessible.

### GitHub Integration
Your local work meets your remote workflow.
- **Issues & PRs**: See open pull requests and assigned issues directly in your project dashboard.
- **Device Flow Auth**: Simple, secure sign-in without complex configuration.

### Context-Aware AI Chat (Alpha)
Ask anything about your work history using Groq (LLaMA 3) or Google Gemini.
- "What did I accomplish yesterday across all projects?"
- "Give me a summary of the changes in the auth feature."
- **Smart Context**: The AI automatically looks at your git logs, file diffs, and activity history.

---

## How it Works

trackmebaby operates as a silent background daemon:
1. **Tray Presence**: Runs in your system tray, staying out of your way until you need it.
2. **Scanner**: Detects git repositories in your base folder (up to 3 levels deep).
3. **Watcher**: Monitors file events via `@parcel/watcher-wasm` with `.gitignore` filtering.
4. **Analyzer**: Periodically polls git status and uncommitted files (every 60s).
5. **AI Orchestrator**: When you ask a question or Warden runs, the app assembles a temporary context of recent diffs and events to guide the AI.

---

## Getting Started

### Installation

Download the latest release for your platform from the [Releases](https://github.com/Feynmunh/trackmebaby/releases) page.

- **Linux:** Extract the .tar.gz and run the installer.
- **macOS:** Extract the .tar.gz and move trackmebaby.app to your Applications folder.
- **Windows:** Run the setup executable.

### Quick Start

1. **Set your Projects Folder**: Open the app from the tray, go to Settings, and point it to where you keep your code.
2. **Configure AI**: Add your Groq or Gemini API key in the Settings panel to enable Chat and Warden.

> [!NOTE]
> Currently, we only support Groq and Google Gemini. Support for more providers (OpenAI, Anthropic, and Local LLMs) is coming soon.

3. **Connect GitHub**: Sign in via the Settings tab to sync your issues and PRs.

---

## Privacy & Security

- **Your Data, Your Machine**: Everything is stored in a local SQLite database. Your activity history and AI chat context never leave your machine.
- **Bring Your Own AI**: Use your own API keys for Groq or Gemini. No third-party servers see your prompts or data.
- **Lightweight & Efficient**: Built with [Electrobun](https://electrobun.dev/) and Bun for minimal resource usage.

---

## Developer Info

### Stack
- **Runtime**: [Electrobun](https://electrobun.dev/) + [Bun](https://bun.sh/)
- **Frontend**: React + Tailwind CSS + Vite
- **Database**: SQLite
- **AI**: Groq / Google Gemini (More providers coming soon)

For detailed architecture and internal documentation, see the [docs/](./docs) folder.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Feynmunh/trackmebaby&type=Date)](https://star-history.com/#Feynmunh/trackmebaby&Date)

---

*Made with ❤️ for developers who juggle multiple projects and forget what they did yesterday.*
