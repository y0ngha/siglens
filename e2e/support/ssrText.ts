/**
 * Strips React SSR comment markers (`<!--...-->`) from raw HTML.
 *
 * React's server renderer splits text nodes around dynamic values (e.g.
 * interpolated numbers) with HTML comments as hydration boundaries. A crawler
 * reads the raw bytes, so `toContain`/`toMatch` assertions against the literal
 * SSR response can spuriously fail when a comment lands mid-sentence. Strip
 * them first so text assertions match what a human/crawler visually sees.
 *
 * Shared by every spec that asserts crawler-facing SSR text (`page.request.get`
 * + text assertions), not just symbol-seo.spec.ts.
 */
export function normalizeReactSsrText(html: string): string {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}
