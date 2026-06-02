import { test, expect } from '../support/fixtures';

/**
 * [symbol] ISR + structured-data SEO (crawler-facing) — Tier 4 cross-cutting.
 *
 * The [symbol] routes were migrated to ISR (generateStaticParams=[] +
 * revalidate=3600) with the SEO-critical surface (single h1, inline JSON-LD,
 * robots) kept in the SSR HTML so JS-disabled crawlers (Naver Yeti / Bing /
 * social unfurlers) still see it. These probes assert that crawler-facing
 * contract against the production build, using page.request (raw HTTP, like a
 * crawler) rather than page navigations — sub-resources and client hydration
 * are irrelevant to what a bot indexes.
 *
 * Ground truth captured against `next start` (E2E build, no FMP key):
 *   - /AAPL (seeded)        → 200, robots "index, follow", 1 <h1>, 8 ld+json blocks
 *   - /MSFT (unseeded)      → 200 + robots "noindex, nofollow" (degraded fallback,
 *                             NOT 500 — getAssetInfoResilient returns a degraded
 *                             ticker rather than throwing; see PR #549)
 *   - /AAPL  warmed 2nd req → `x-nextjs-cache: HIT` (ISR cache serves the route)
 */

// `[\s\S]*?` (not the `s`/dotAll flag, which needs an es2018+ target) so the
// matcher is newline-tolerant while staying within this project's TS target.
const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

/**
 * Pull every inline JSON-LD block out of SSR HTML and JSON.parse it (which also
 * proves each block is syntactically valid — JsonLd unicode-escapes any `<` in
 * the JSON, which is still legal JSON, so the parse round-trips). Returns the
 * root @type of each block.
 */
function rootJsonLdTypes(html: string): string[] {
    const types: string[] = [];
    for (const match of html.matchAll(LD_JSON_RE)) {
        const parsed = JSON.parse(match[1]) as Record<string, unknown>;
        types.push(String(parsed['@type']));
    }
    return types;
}

function countH1(html: string): number {
    return (html.match(/<h1[\s>]/g) ?? []).length;
}

test.describe('symbol SEO + ISR (crawler-facing)', () => {
    test('/AAPL embeds valid inline JSON-LD (WebPage + BreadcrumbList + FAQPage)', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        // The page-level @types are asserted individually below — those are the
        // falsifiable guard (dropping any one fails the test). The length is only
        // a floor, not an exact total, because the global SiteJsonLd blocks are
        // out of this page's scope and free to change independently.
        expect(types.length).toBeGreaterThanOrEqual(3);
        expect(types).toContain('WebPage');
        expect(types).toContain('BreadcrumbList');
        expect(types).toContain('FAQPage');
    });

    test('/AAPL/news embeds valid inline JSON-LD (Article + BreadcrumbList)', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL/news');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        // Floor + explicit page-level @types (see the /AAPL test): the global
        // SiteJsonLd total is out of scope, so the Article/BreadcrumbList
        // presence checks are the falsifiable guard.
        expect(types.length).toBeGreaterThanOrEqual(3);
        expect(types).toContain('Article');
        expect(types).toContain('BreadcrumbList');
    });

    test('/AAPL SSR HTML has exactly one h1 (no cloaking / no duplicate headings)', async ({
        page,
    }) => {
        const html = await (await page.request.get('/AAPL')).text();
        expect(countH1(html)).toBe(1);
    });

    test('/AAPL is served from the ISR cache (x-nextjs-cache HIT on a warmed request)', async ({
        page,
    }) => {
        // Warm the route so this assertion is independent of suite ordering
        // (a cold first-ever request would be MISS; the second is HIT).
        await page.request.get('/AAPL');
        const response = await page.request.get('/AAPL');

        expect(response.status()).toBe(200);
        expect(response.headers()['x-nextjs-cache']).toBe('HIT');
        expect(response.headers()['cache-control']).toContain('s-maxage=3600');
    });

    test('an unseeded but well-formed ticker degrades to 200 + noindex (never 500)', async ({
        page,
    }) => {
        // MSFT is format-valid but not in the E2E seed (only AAPL is). With no
        // FMP key under E2E, getAssetInfo throws an infra error which
        // getAssetInfoResilient catches → degraded fallback. The ISR cold-gen
        // must complete 200 (a thrown DYNAMIC_SERVER_USAGE would 500 — the F2
        // regression fixed in #549), and generateMetadata must emit noindex.
        const response = await page.request.get('/MSFT');
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toMatch(
            /<meta name="robots" content="noindex, nofollow"\/?>/
        );
        expect(countH1(html)).toBe(1);
        // The single SSR h1 is buildChartPageHeading(displayName). When degraded,
        // the display name falls back to the bare ticker, so the heading text
        // itself must carry "MSFT" — proving the fallback, not merely that the
        // symbol appears somewhere incidental (a canonical URL, an OG tag).
        const h1Text = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
        expect(h1Text).toContain('MSFT');
    });
});
