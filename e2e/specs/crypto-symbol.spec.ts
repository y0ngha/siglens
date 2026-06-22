import { test, expect } from '../support/fixtures';

/**
 * Crypto symbol page E2E coverage — Rec #4 of the crypto post-audit.
 *
 * Why this spec exists:
 * The crypto flow was never covered in E2E (seed.ts did not populate
 * `crypto_assets`), which allowed crypto-specific bugs (Phase 1-2) to
 * ship undetected. This spec adds the minimal coverage to prevent that:
 *   1. /BTCUSD renders (page-level smoke — the most impactful gap).
 *   2. Crypto-specific tab whitelist: after hydration, only chart/news/
 *      fear-greed/overall tabs are visible (equity-only tabs absent).
 *   3. /api/sitemap/crypto returns 200 XML (crawler path).
 *
 * Data dependency: seed.ts now seeds `crypto_assets` (BTCUSD, ETHUSD)
 * so getAssetInfo('BTCUSD') resolves via DB and returns marketProfile:'crypto'.
 *
 * Selector notes (same conventions as symbol-tabs.spec.ts):
 *   - Chart page h1 is rendered by SymbolPageClient inside the timeframe bar.
 *     The heading contains the ticker symbol ("BTCUSD"), so `name: /BTCUSD/`
 *     matches reliably regardless of the display name format.
 *   - The tab nav `<nav aria-label="분석 종류">` is rendered by SymbolTabs
 *     (client component) — it only shows after React hydration, so we
 *     `waitFor` its visibility before asserting tab presence/absence.
 *   - Tab links are `<a role="link">` inside the nav (not a tablist). We
 *     assert absence via `not.toBeVisible()` since invisible (never-mounted)
 *     links count as not visible.
 */

const TAB_NAV_NAME = '분석 종류';
const HYDRATION_TIMEOUT = 20_000; // nav won't appear until React hydrates
const VISIBLE_TIMEOUT_MS = 15_000; // heading/element visible after SSR paint
const TAB_VISIBLE_TIMEOUT_MS = 5_000; // individual tab links after nav is already visible
const NOT_FOUND_TIMEOUT_MS = 10_000; // not-found page heading after navigation

test.describe('crypto symbol page', () => {
    test('smoke: /BTCUSD renders a heading containing the ticker', async ({
        page,
    }) => {
        await page.goto('/BTCUSD');

        // The chart page h1 contains the displayName + "차트 분석".
        // For BTCUSD (seeded as "Bitcoin USD" / "비트코인"), the displayName
        // resolves to a string that always includes "BTCUSD".
        await expect(
            page.getByRole('heading', { level: 1, name: /BTCUSD/ })
        ).toBeVisible({ timeout: VISIBLE_TIMEOUT_MS });
    });

    test('crypto tab whitelist: chart/news/fear-greed/overall tabs present after hydration', async ({
        page,
    }) => {
        await page.goto('/BTCUSD');

        const tabNav = page.getByRole('navigation', { name: TAB_NAV_NAME });

        // Wait for the tab nav to appear (requires React hydration of SymbolTabs).
        await expect(tabNav).toBeVisible({ timeout: HYDRATION_TIMEOUT });

        // Crypto-allowed tabs MUST be present.
        for (const label of ['차트', '뉴스', '공포 탐욕 지수', '종합']) {
            await expect(
                tabNav.getByRole('link', { name: label, exact: true })
            ).toBeVisible({ timeout: TAB_VISIBLE_TIMEOUT_MS });
        }
    });

    test('equity-only tabs absent for crypto: 펀더멘털/재무제표/의회 거래/옵션 not rendered', async ({
        page,
    }) => {
        await page.goto('/BTCUSD');

        const tabNav = page.getByRole('navigation', { name: TAB_NAV_NAME });

        // Wait for hydration so we can be sure the nav is fully rendered.
        await expect(tabNav).toBeVisible({ timeout: HYDRATION_TIMEOUT });

        // Equity-only tabs must NOT be visible.
        for (const label of ['펀더멘털', '재무제표', '의회 거래', '옵션']) {
            await expect(
                tabNav.getByRole('link', { name: label, exact: true })
            ).not.toBeVisible();
        }
    });

    test('/api/sitemap/crypto returns 200 XML', async ({ page }) => {
        // The crypto sitemap reads from crypto_assets table — if the table is
        // empty the response still 200s (with an empty urlset), so this test
        // validates the route exists and is not broken. With the seeded rows
        // (BTCUSD/ETHUSD) it also exercises the URL-building code path.
        const response = await page.request.get('/api/sitemap/crypto');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toMatch(/xml/);
    });

    test('equity-only tab URL /BTCUSD/options renders not-found page', async ({
        page,
    }) => {
        // Validates the real isCryptoSymbolStatic → descriptor.tabs seam against
        // the seeded crypto_assets row (BTCUSD). The page body guard calls
        // isTabAllowedForSymbol('BTCUSD', 'options') → false → notFound().
        //
        // Next.js App Router streams the layout shell first and then replaces the
        // page segment with the nearest not-found.tsx. The HTTP response is 200
        // (the shell is committed before the page segment resolves — see
        // not-found.spec.ts for the framework-level documentation of this
        // behavior). We therefore assert the rendered outcome rather than the
        // raw HTTP status, which is an unreliable implementation detail here.
        //
        // Without the seed this route would resolve getAssetInfo as null and call
        // notFound() via a different code path, so seeding BTCUSD is load-bearing
        // for testing the isTabAllowedForSymbol seam specifically.
        await page.goto('/BTCUSD/options');

        // The global not-found.tsx renders this heading.
        await expect(
            page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })
        ).toBeVisible({ timeout: NOT_FOUND_TIMEOUT_MS });
    });
});
