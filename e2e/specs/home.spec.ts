import { test, expect } from '../support/fixtures';

/**
 * Home page (`/`) — Tier 3 render + search-nav outcomes.
 *
 * Asserts the stable, data-independent markers the landing page emits from RSC:
 *   - the hero h1 (marketing copy, no FMP/LLM dependency);
 *   - the always-present header ticker search (scoped to the banner landmark —
 *     the same combobox is also rendered in the hero panel, so an unscoped query
 *     would be a strict-mode violation; see smoke.spec.ts);
 *   - searching a symbol lands on the server-rendered symbol page (search
 *     short-circuits to the seeded AAPL row under E2E, never a real API).
 *
 * Chromium-only (no @webkit tag): a desktop render/search check. The mobile PWA
 * banner is covered by pwa-install.spec.ts.
 */
test.describe('home page', () => {
    test('renders the hero and the header ticker search', async ({ page }) => {
        await page.goto('/');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /AI가 완성하는 SIGLENS/,
            })
        ).toBeVisible();

        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });

    test('searching a symbol navigates to its rendered symbol page', async ({
        page,
    }) => {
        await page.goto('/');

        const search = page
            .getByRole('banner')
            .getByRole('combobox', { name: '종목 티커 검색' });
        await search.fill('aapl');
        await search.press('Enter');

        await page.waitForURL('**/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible();
    });
});
