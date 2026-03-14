# AI Integration — trackmebaby

trackmebaby uses AI to power two primary features: natural language chat about developer activity and Warden project health analysis. The system is designed to be lightweight, using fetch-based API calls instead of bulky npm SDKs. Groq with LLaMA 3.3 70B, Google Gemini, and OpenAI-compatible APIs are the supported providers.

## Architecture

The AI logic lives in `src/bun/services/ai/`.

```
src/bun/services/ai/
├── provider.ts           # AIProvider interface definition
├── groq-provider.ts      # Groq implementation (fetch-based)
├── gemini-provider.ts   # Google Gemini implementation (fetch-based)
├── index.ts              # Provider factory + API key helper
├── config.ts             # Environment variable helpers
├── context-assembler.ts  # Builds activity context for chat queries
├── warden-context.ts     # Builds context for Warden analysis
└── warden-prompt.ts      # Warden system prompt + response parser
```

## Provider Interface

The `AIProvider` interface in `provider.ts` ensures the system can support multiple AI backends.

- `query(context, question, systemPrompt?, options?)`: Single-turn query.
- `queryMultiTurn(systemPrompt, messages, options?)`: Multi-turn conversation.
- `testConnection()`: Validates API key and connectivity.
- `AIQueryOptions`: Supports `maxTokens` and `jsonMode`.
- `ChatTurn`: Type for conversation history with `role` ("user" | "assistant") and `content`.

## Groq Provider

The `GroqProvider` implements the interface using native `fetch()` against Groq's OpenAI-compatible endpoint.

- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Default Model**: `llama-3.3-70b-versatile`
- **Temperature**: Fixed at 0.3 for consistent, predictable output.
- **JSON Mode**: Supported via `response_format: { type: "json_object" }`.
- **Error Handling**: Provides specific feedback for 401/403 (Invalid Key) and 429 (Rate Limit) errors.

## Provider Factory

The factory in `index.ts` manages provider instantiation.

- `createAIProvider({ provider, apiKey, model })`: Returns an `AIProvider` instance.
- `getSavedApiKey()`: Retrieves the API key from environment variables (`GROQ_API_KEY`, `GEMINI_API_KEY`, or `AI_API_KEY`).

The factory pattern supports multiple providers: Groq, Google Gemini, and OpenAI-compatible APIs (via GroqProvider).

## Context Assembly for Chat

The `context-assembler.ts` builds the "memory" for AI queries by pulling data from SQLite and the filesystem.

- `assembleContext(db, question, options)`: Main entry point.
- **Task Types**: Supports `general`, `project_summary`, and `file_summary`.
- **Time Range**: Parses natural language (e.g., "today", "yesterday", "last 7 days") to filter database events.
- **Symbol Analysis**: Uses `git grep` to find call sites for exported symbols in the active file.
- **Safety**:
    - `MAX_CONTEXT_CHARS`: 14,000
    - `MAX_DIFF_CHARS`: 6,000
    - `MAX_FILE_CHARS`: 12,000
    - `MAX_FILE_BYTES`: 200,000
    - Path traversal protection rejects any paths containing `..` patterns.

## Warden Analysis

Warden provides proactive insights and tasks for your projects.

### Context Building
`warden-context.ts` assembles project metadata, git history, and recent activity. It prioritizes the most relevant data within a 16,000 character budget and limits project file listings to the top 100 files.

### Prompt and Parsing
`warden-prompt.ts` contains the `WARDEN_SYSTEM_PROMPT`, which enforces a strict JSON schema:

```json
{
  "insights": [
    {
      "severity": "warning",
      "category": "tech_debt",
      "title": "string",
      "description": "string",
      "affectedFiles": ["string"]
    }
  ],
  "todos": [{ "task": "string" }],
  "completed_todo_ids": ["string"]
}
```

- **Categories**: security, tech_debt, project_health, suggestion, testing_gap, deprecation, dependency, refactoring.
- **Severities**: critical, warning, info.
- **Parsing**: `parseWardenResponse` validates the AI output against the schema before returning it to the service.

## Adding a New AI Provider

To add a new provider:
1. Create a new file (e.g., `openai-provider.ts`) implementing the `AIProvider` interface.
2. Use native `fetch()` for all requests. Do not add npm SDKs.
3. Register the new provider in the `createAIProvider` factory in `index.ts`.
4. Update the settings UI in the frontend to include the new option.

## Configuration

AI settings are stored in the SQLite `settings` table. Users can configure the provider and model via the Settings panel. The system requires a valid API key set as an environment variable or via the UI to function.
