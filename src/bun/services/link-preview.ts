/**
 * Link Preview Service — fetches Open Graph metadata from URLs
 * Uses fetch + regex parsing (no npm SDKs per AGENTS.md)
 */
import type { LinkPreview } from "../../shared/types.ts";

export async function fetchLinkPreview(
    url: string,
): Promise<LinkPreview | null> {
    try {
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

        const html = await response.text();

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

        // Image
        const image = getMetaContent("image") || null;

        // Site name
        const siteName = getMetaContent("site_name") || null;

        // Favicon
        const parsedUrl = new URL(url);
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
