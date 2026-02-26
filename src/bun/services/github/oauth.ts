import { toErrorMessage } from "../../../shared/error.ts";
import type { GitHubTokenResponse } from "./api.ts";

export const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const CALLBACK_PORT = 7890;
export const CALLBACK_PATH = "/callback";

type OAuthTokenHandler = (token: string) => Promise<string | null>;

export function startOAuthServer(
    clientId: string,
    clientSecret: string,
    onToken: OAuthTokenHandler,
): { server: ReturnType<typeof Bun.serve>; cleanup: () => void } {
    let authServer: ReturnType<typeof Bun.serve> | null = null;
    let authTimeout: Timer | null = null;

    const cleanup = () => {
        if (authTimeout) {
            clearTimeout(authTimeout);
            authTimeout = null;
        }
        if (authServer) {
            authServer.stop();
            authServer = null;
        }
    };

    const scheduleCleanup = () => {
        setTimeout(() => cleanup(), 1000);
    };

    authServer = Bun.serve({
        port: CALLBACK_PORT,
        fetch: async (req) => {
            const url = new URL(req.url);

            if (url.pathname === CALLBACK_PATH) {
                const code = url.searchParams.get("code");
                const error = url.searchParams.get("error");

                if (error || !code) {
                    scheduleCleanup();
                    return new Response(
                        getCallbackHtml(
                            false,
                            error || "No authorization code received",
                        ),
                        {
                            headers: { "Content-Type": "text/html" },
                        },
                    );
                }

                try {
                    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                        },
                        body: JSON.stringify({
                            client_id: clientId,
                            client_secret: clientSecret,
                            code,
                        }),
                    });

                    const tokenData =
                        (await tokenResponse.json()) as GitHubTokenResponse;

                    if (tokenData.error || !tokenData.access_token) {
                        scheduleCleanup();
                        return new Response(
                            getCallbackHtml(
                                false,
                                tokenData.error_description ||
                                    tokenData.error ||
                                    "Failed to exchange code",
                            ),
                            {
                                headers: { "Content-Type": "text/html" },
                            },
                        );
                    }

                    const username = await onToken(tokenData.access_token);

                    scheduleCleanup();
                    return new Response(
                        getCallbackHtml(true, undefined, username || undefined),
                        {
                            headers: { "Content-Type": "text/html" },
                        },
                    );
                } catch (err: unknown) {
                    scheduleCleanup();
                    return new Response(
                        getCallbackHtml(false, toErrorMessage(err)),
                        {
                            headers: { "Content-Type": "text/html" },
                        },
                    );
                }
            }

            return new Response("Not found", { status: 404 });
        },
    });

    authTimeout = setTimeout(() => {
        cleanup();
    }, 120000);

    return { server: authServer, cleanup };
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function getCallbackHtml(
    success: boolean,
    error?: string,
    username?: string,
): string {
    if (success) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Connected to GitHub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #0d1117; color: #f0f6fc;
        }
        .card {
            text-align: center; max-width: 420px; padding: 48px 40px;
            background: #161b22; border: 1px solid #30363d;
            border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .check {
            width: 64px; height: 64px; margin: 0 auto 24px;
            background: rgba(46,160,67,0.15); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        }
        .check svg { width: 32px; height: 32px; color: #2ea043; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #f0f6fc; }
        .username {
            display: inline-flex; align-items: center; gap: 8px;
            background: #21262d; border: 1px solid #30363d;
            border-radius: 8px; padding: 8px 16px; margin: 12px 0;
            font-size: 14px; font-weight: 500; color: #f0f6fc;
        }
        .username svg { width: 16px; height: 16px; color: #8b949e; }
        .hint {
            color: #8b949e; font-size: 13px; line-height: 1.5; margin-top: 16px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </div>
        <h1>You're connected!</h1>
        ${
            username
                ? `<div class="username">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
            ${escapeHtml(username)}
        </div>`
                : ""
        }
        <p class="hint">You can close this tab and return to <strong>trackmebaby</strong>.</p>
    </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #0d1117; color: #f0f6fc;
        }
        .card {
            text-align: center; max-width: 420px; padding: 48px 40px;
            background: #161b22; border: 1px solid #30363d;
            border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .icon {
            width: 64px; height: 64px; margin: 0 auto 24px;
            background: rgba(218,54,51,0.15); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        }
        .icon svg { width: 32px; height: 32px; color: #da3633; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #f0f6fc; }
        .error { color: #da3633; font-size: 13px; margin-bottom: 16px; }
        .hint { color: #8b949e; font-size: 13px; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </div>
        <h1>Something went wrong</h1>
        <p class="error">${escapeHtml(error || "Unknown error")}</p>
        <p class="hint">Please close this tab and try again in <strong>trackmebaby</strong>.</p>
    </div>
</body>
</html>`;
}
