/**
 * Link Preview Service — fetches Open Graph metadata from URLs
 * Uses fetch + regex parsing (no npm SDKs per AGENTS.md)
 */
import type { LinkPreview } from "../../shared/types.ts";

/** Maximum HTML body size to read (2 MB) — prevents memory issues on large pages */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Private/reserved IP ranges that should not be fetched (SSRF protection) */
const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "[::1]",
    "metadata.google.internal",
    "169.254.169.254",
]);

function isBlockedHost(hostname: string): boolean {
    if (BLOCKED_HOSTNAMES.has(hostname)) return true;
    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    return false;
}

export async function fetchLinkPreview(
    url: string,
): Promise<LinkPreview | null> {
    try {
        // Validate URL scheme — only allow http/https
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return null;
        }

        // Block localhost / private IPs (SSRF protection)
        if (isBlockedHost(parsedUrl.hostname)) {
            return null;
        }

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; trackmebaby/1.0; +https://github.com)",
                Accept: "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(8000),
            redirect: "follow",
        });

        if (!response.ok) return null;

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) return null;

        // Stream-read with size limit to prevent memory issues
        const reader = response.body?.getReader();
        if (!reader) return null;

        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (totalBytes < MAX_RESPONSE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalBytes += value.byteLength;
        }
        reader.cancel().catch(() => {});

        const html = new TextDecoder().decode(
            chunks.length === 1
                ? chunks[0]
                : new Uint8Array(
                      chunks.reduce((buf, chunk) => {
                          buf.set(chunk, buf.length - chunk.byteLength);
                          return buf;
                      }, new Uint8Array(totalBytes)),
                  ),
        );

        const getMetaContent = (property: string): string | null => {
            // Check og: and twitter: variants
            for (const prefix of ["og:", "twitter:"]) {
                const tag = `${prefix}${property}`;
                // property="og:X" content="..."
                const r1 = new RegExp(
                    `<meta[^>]*(?:property|name)=["']${tag}["'][^>]*content=["']([^"']*)["']`,
                    "i",
                );
                const m1 = html.match(r1);
                if (m1?.[1]) return m1[1];

                // content="..." property="og:X" (reversed order)
                const r2 = new RegExp(
                    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${tag}["']`,
                    "i",
                );
                const m2 = html.match(r2);
                if (m2?.[1]) return m2[1];
            }
            return null;
        };

        // Title: og:title > <title>
        const ogTitle = getMetaContent("title");
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = ogTitle || titleMatch?.[1]?.trim() || null;

        // Description: og > meta name="description"
        const ogDesc = getMetaContent("description");
        const metaDescMatch = html.match(
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
        );
        const metaDescMatch2 = html.match(
            /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i,
        );
        const description =
            ogDesc || metaDescMatch?.[1] || metaDescMatch2?.[1] || null;

        // Image — resolve relative URLs against the page URL
        const rawImage = getMetaContent("image");
        const image =
            rawImage && !rawImage.startsWith("http")
                ? new URL(rawImage, parsedUrl).toString()
                : rawImage || null;

        // Site name
        const siteName = getMetaContent("site_name") || null;

        // Favicon
        const faviconMatch = html.match(
            /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i,
        );
        const faviconMatch2 = html.match(
            /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
        );
        const rawFavicon =
            faviconMatch?.[1] || faviconMatch2?.[1] || "/favicon.ico";
        const favicon = rawFavicon.startsWith("http")
            ? rawFavicon
            : `${parsedUrl.origin}${rawFavicon.startsWith("/") ? "" : "/"}${rawFavicon}`;

        return { title, description, image, favicon, siteName };
    } catch {
        return null;
    }
}
