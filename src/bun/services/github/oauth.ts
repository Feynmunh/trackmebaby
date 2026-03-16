import type { GitHubDeviceCodeResponse, GitHubTokenResponse } from "./api.ts";
import { GITHUB_DEVICE_CODE_URL } from "./api.ts";

export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export async function requestDeviceCode(
    clientId: string,
    scope: string = "read:user repo",
): Promise<GitHubDeviceCodeResponse> {
    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("scope", scope);

    const res = await fetch(GITHUB_DEVICE_CODE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: params.toString(),
    });

    if (!res.ok) {
        throw new Error(`Failed to request device code: ${res.statusText}`);
    }

    return (await res.json()) as GitHubDeviceCodeResponse;
}

export async function pollForToken(
    clientId: string,
    deviceCode: string,
): Promise<GitHubTokenResponse> {
    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("device_code", deviceCode);
    params.set("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

    const res = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: params.toString(),
    });

    if (!res.ok) {
        throw new Error(`Failed to poll for token: ${res.statusText}`);
    }

    return (await res.json()) as GitHubTokenResponse;
}
