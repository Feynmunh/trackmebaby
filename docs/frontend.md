# Frontend — trackmebaby

The trackmebaby frontend is a React application styled with Tailwind CSS. It runs within an Electrobun webview and uses Vite as its build tool and development server, typically on port 5173.

The entry point for the application is `src/mainview/main.tsx`, which renders the `App.tsx` component. `App.tsx` serves as the primary shell, containing the tab navigation and a resizable sidebar for AI interactions.

## Directory Layout

```
src/mainview/
├── App.tsx            # Tab shell with resizable AI sidebar
├── main.tsx           # React entry point
├── rpc.ts             # Frontend RPC client
├── index.css          # Global styles + CSS variables
├── index.html         # HTML entry
├── components/        # Reusable UI components
│   ├── TabBar.tsx     # Bottom tab navigation
│   ├── icons/         # SVG icon components
│   ├── ui/            # Generic UI (Toast, Tooltip, Markdown, StatCard, etc.)
│   └── utils/         # Utility functions (vitality status)
├── features/          # Feature-specific modules
│   ├── ai/            # AI chat feature
│   ├── git/           # Git status views
│   ├── github/        # GitHub integration views
│   ├── projects/      # Project management
│   ├── settings/      # Settings panel
│   ├── vault/         # Resource vault
│   └── warden/        # Warden insights
├── hooks/             # Custom React hooks
│   ├── useProjectData.ts
│   └── useGitHubIntegration.ts
└── tabs/              # Top-level tab views
    ├── CardsTab.tsx   # Projects grid with search
    └── cards/         # Project card sub-components
```

## Component Patterns

Developers should follow these patterns when building frontend components:
- Use functional components with hooks. Do not use class components.
- Define explicit TypeScript interfaces for all component props.
- Apply Tailwind utility classes for all styling. Do not use CSS modules.
- Organize code into feature-based modules within the `features/` directory.

## Design System

The project uses a hybrid token system. CSS variables defined in HSL format act as the source of truth, and Tailwind utilities reference these variables.

### Theme Tokens

Tokens are mapped in `tailwind.theme.mjs` using the `hsl(var(--token) / <alpha-value>)` pattern.

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| app-bg | --app-bg | Window background |
| app-surface | --app-surface | Cards and panels |
| app-surface-elevated | --app-surface-elevated | Inputs and secondary panels |
| app-text-main | --app-text-main | Primary text |
| app-text-muted | --app-text-muted | Secondary text and labels |
| app-border | --app-border | Separators and borders |
| app-accent | --app-accent | Brand accent color (orange) |
| app-hover | --app-hover | Hover states |
| app-success | --app-success | Success status indicators |
| app-warning | --app-warning | Warning status indicators |
| app-error | --app-error | Error status indicators |
| app-info | --app-info | Informational status indicators |

### Styling Rules

- Do not use the `dark:` prefix. CSS variables automatically switch values when the `.dark` class is toggled on the root element.
- Avoid raw Tailwind colors like `bg-zinc-800`. Use semantic tokens such as `bg-app-surface` instead.
- If you add new tokens, you must map them in `tailwind.theme.mjs` using the HSL pattern.
- The `.theme-switching` class on the root element suppresses transitions during theme toggles to prevent visual flickering.

## Key Components

- **TabBar**: Handles bottom navigation and includes floating tooltips for each item.
- **Toast**: A notification system that uses the `motion` library for stacking and entrance animations.
- **Markdown**: Renders markdown content using `react-markdown` and `remark-gfm`, including a copy-to-clipboard feature for code blocks.
- **Tooltip**: A position-aware tooltip component that does not require a portal.
- **StatCard**: Displays project metrics and can show authentication prompts if required.

## Custom Hooks

- **useProjectData**: Fetches and synchronizes project activity, git status, and general statistics via RPC.
- **useGitHubIntegration**: Manages GitHub authentication status and retrieves related issues and pull requests.

## Animations

The application uses the `motion` library for all animations. This includes toast notifications, tab transitions, and sidebar resizing. Use `motion` components instead of raw CSS transitions for complex interactions.
