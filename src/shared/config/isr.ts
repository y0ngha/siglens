/**
 * ISR revalidate periods shared across config and sitemap helpers.
 *
 * NOTE: these constants MUST NOT be used as Next.js route segment config values
 * (e.g. `export const revalidate = CRYPTO_CHART_ISR_PERIOD_HOURS * 3600`).
 * Next.js static analysis requires route segment config to be a plain numeric
 * literal — importing a constant causes the config to be silently ignored and
 * the route to fall back to dynamic rendering.
 * (app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for
 * Next.js static analysis — the magic-number-extraction rule does not apply here.)
 *
 * Use these constants in sitemap helpers, TTL calculations, and test assertions
 * where no Next.js static analysis is involved.
 */

/**
 * Crypto chart page ISR period in hours (matches `revalidate = 21600` in
 * `app/[symbol]/page.tsx`). Used to align sitemap lastmod quantization with
 * the actual page regeneration cadence so Googlebot does not recrawl faster
 * than content can change.
 */
export const CRYPTO_CHART_ISR_PERIOD_HOURS = 6;
