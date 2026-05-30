import { test, expect } from '../support/fixtures';

/**
 * SEO infrastructure smoke (`/`) — Tier 4 cross-cutting outcome.
 *
 * Asserts the crawler-facing endpoints respond 200 with the right content-type:
 *   - robots.txt, the PWA manifest, the sitemap index + a sub-sitemap
 *     (`/sitemap.xml` → `/api/sitemap` via next.config rewrite), and
 *   - the six per-symbol OpenGraph images (file-based opengraph-image routes,
 *     no generateImageMetadata so each is served at `<route>/opengraph-image`).
 *
 * Uses page.request (APIRequestContext) so these are raw HTTP probes, not page
 * navigations — content-type and status are what crawlers/social unfurlers see.
 * Under E2E the OG images render from faked providers (no real external API).
 */
const TEXT_ENDPOINTS = [
    { path: '/robots.txt', contentType: /text\/plain/ },
    {
        path: '/manifest.webmanifest',
        contentType: /manifest\+json|application\/json/,
    },
    { path: '/sitemap.xml', contentType: /xml/ },
    { path: '/sitemap-static.xml', contentType: /xml/ },
] as const;

const OG_IMAGE_ROUTES = [
    '/AAPL/opengraph-image',
    '/AAPL/news/opengraph-image',
    '/AAPL/fundamental/opengraph-image',
    '/AAPL/options/opengraph-image',
    '/AAPL/fear-greed/opengraph-image',
    '/AAPL/overall/opengraph-image',
] as const;

test.describe('seo smoke', () => {
    for (const endpoint of TEXT_ENDPOINTS) {
        test(`${endpoint.path} responds 200 with the expected content-type`, async ({
            page,
        }) => {
            const response = await page.request.get(endpoint.path);
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toMatch(
                endpoint.contentType
            );
        });
    }

    for (const ogRoute of OG_IMAGE_ROUTES) {
        test(`${ogRoute} renders a PNG OpenGraph image`, async ({ page }) => {
            const response = await page.request.get(ogRoute);
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toMatch(/image\/png/);
        });
    }
});
