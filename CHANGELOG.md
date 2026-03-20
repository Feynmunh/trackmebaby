# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-03-20 - Cross-Platform Icons and Windows Titlebar

### Added
- **Native App Icons**: Application icons for all platforms — macOS (.iconset), Windows (.ico), and Linux (.png) with full Retina support (16px to 1024px).
- **Windows Native Titlebar**: Custom titlebar service with proper theme synchronization between light/dark modes and the app UI.

### Fixed
- **Windows Release Packaging**: Release workflow now outputs complete .zip archive instead of a bare .exe file.

## [0.2.0] - 2026-03-17 - OS Keychain Integration

### Added
- **GitHub OAuth Device Flow**: Sign in with GitHub to view issues and pull requests directly in the app.
- **Secure Token Storage**: API keys and GitHub tokens are stored in the OS keychain when available, with SQLite fallback.
- **Project GitHub Data**: View open issues, open PRs, and contributor count for each tracked project.

### Changed
- Updated AI provider architecture with a unified secret store for secure credential management.

## [0.1.0] - 2026-03-13 - Initial Release

### Added
- **Intelligent Project Monitoring**: Automatic discovery and monitoring of local Git repositories across your workspace.
- **AI-Powered Work Memory**: Query your recent activity using Groq, Gemini, or OpenAI to get context-aware answers about your development progress.
- **Flexible AI Providers**: Built-in support for multiple LLM providers with easy configuration for API keys and model selection.
- **Deep Git Integration**: Real-time tracking of branch changes, commits, and file modifications with zero manual configuration.
- **Local-First Performance**: Blazing fast Electrobun architecture with a private, local SQLite database for total data ownership.
- **Minimalist Tray Interface**: A non-intrusive background daemon that stays out of your way until you need it.
- **Cross-Platform Readiness**: Native-feel performance across Linux, macOS, and Windows.

[Unreleased]: https://github.com/Feynmunh/trackmebaby/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Feynmunh/trackmebaby/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Feynmunh/trackmebaby/releases/tag/v0.2.0
[0.1.0]: https://github.com/Feynmunh/trackmebaby/releases/tag/v0.1.0
