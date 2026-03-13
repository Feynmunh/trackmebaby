# RPC Bridge — trackmebaby

The trackmebaby application uses a typed RPC bridge to connect the Bun backend process with the React frontend in the webview. This bridge is built on Electrobun's `BrowserView.defineRPC()` method. The primary contract for this communication is defined in `src/shared/rpc-types.ts`.

## Architecture

Communication flows between the frontend client and backend handlers through the Electrobun RPC layer.

```
Frontend (rpc.ts)  ←→  Electrobun RPC  ←→  Backend (bridge.ts)
     ↓                                           ↓
rpc.request.*()                          Feature registrars
rpc.subscribe.*()                        (ai, git, github, projects,
                                          settings, system, vault,
                                          warden, window)
```

## Contract Definition

The `src/shared/rpc-types.ts` file defines the `TrackmeBabyRPC` type, which contains the following categories:

- **bun.requests**: Handlers residing in the backend that the frontend calls. Examples include `getProjects`, `queryAI`, and `sendChatMessage`.
- **bun.messages**: Push messages sent from the backend to the frontend, primarily used for log entries.
- **webview.messages**: Events pushed from the backend to the frontend to trigger UI updates. Examples include `projectsUpdated`, `activityEvent`, and `gitStatusChanged`.

## Backend Implementation

The backend bridge is initialized in `src/bun/rpc/bridge.ts`. The `createRPC` function sets up the bridge by combining handlers from various feature registrars.

Each feature module exports a register function located in `src/bun/rpc/features/*/registrar.ts`. These registrars return a partial handlers object that is merged into the final RPC definition.

Example registrar pattern:
```typescript
export function registerProjectHandlers({ db }: { db: Database }) {
    return {
        getProjects: async () => getProjects(db),
        // other project handlers
    };
}
```

The bridge is configured with a `maxRequestTime` of 15,000 milliseconds.

## Frontend Client

The frontend interacts with the bridge through `src/mainview/rpc.ts`. This client wraps Electrobun's RPC capabilities with convenient asynchronous functions.

### Request Pattern
To call a backend handler and wait for a response:
```typescript
const projects = await rpc.request.getProjects({});
```

### Subscription Pattern
To listen for push messages from the backend:
```typescript
rpc.subscribe.projectsUpdated((data) => {
    // handle the update
});
```

## Adding a New RPC Endpoint

Follow these steps to add a new endpoint:
1. Define the request and response types in `src/shared/rpc-types.ts` under the `bun.requests` section.
2. Implement the handler in the corresponding feature registrar in the backend.
3. Call the new endpoint from the frontend using `rpc.request.newEndpoint(params)`.
4. For push messages, add the type to `webview.messages` and use `rpc.send.messageName(data)` from the backend.

## Key Endpoints

| Endpoint | Direction | Purpose |
|----------|-----------|---------|
| getProjects | request | Fetches all projects currently tracked by the app |
| getProjectActivity | request | Retrieves activity events for a specific project |
| getGitStatus | request | Gets the latest git snapshot for a project |
| sendChatMessage | request | Sends a message to the AI and receives a response |
| getSettings / updateSettings | request | Reads or modifies the application configuration |
| scanProjects | request | Triggers a manual scan for new projects |
| projectsUpdated | push | Notifies the UI that the project list has changed |
| gitStatusChanged | push | Notifies the UI of changes in a project's git status |
| wardenInsightsUpdated | push | Notifies the UI of new warden analysis results |

## Contract Change Rules

- When modifying `src/shared/rpc-types.ts`, you must update both the backend handlers and the frontend consumers in the same pull request.
- Clearly note any contract changes in the pull request summary.
- Prefer adding new fields or endpoints instead of making breaking changes to existing ones.
