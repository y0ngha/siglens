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

    // robots.txt는 unit 테스트가 객체를 검증하지만, 실제 직렬화된 본문(크롤러가 보는 것)이
    // AI-bot 정책을 담고 있는지는 unit이 못 잡는다. 본문을 직접 probe해 직렬화 회귀를 막는다.
    test('/robots.txt body advertises the AI-bot policy + /api/ disallow + sitemap', async ({
        page,
    }) => {
        const response = await page.request.get('/robots.txt');
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('GPTBot');
        expect(body).toMatch(/Crawl-delay:\s*60/i);
        expect(body).toContain('Disallow: /api/');
        expect(body).toMatch(/Sitemap:\s*\S+\/sitemap\.xml/i);
    });

    // long-tail sub-sitemap 라우트는 unit-mock만 돼 있어 next.config rewrite
    // (/sitemap-longtail-{n}.xml → /api/sitemap/longtail/{n})가 e2e로 검증된 적이 없다.
    // 범위 밖 페이지는 DB 시드와 무관하게 핸들러가 자체 404를 반환하므로, rewrite+핸들러
    // 결선을 결정적으로 검증한다(MAX_LONGTAIL_SITEMAP_PAGE=10000 초과 → 404).
    test('/sitemap-longtail-99999.xml (out-of-range) routes to the handler and 404s', async ({
        page,
    }) => {
        const response = await page.request.get('/sitemap-longtail-99999.xml');
        expect(response.status()).toBe(404);
    });
});
