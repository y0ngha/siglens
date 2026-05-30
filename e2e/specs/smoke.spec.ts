import { test, expect } from '../support/fixtures';

/**
 * Integration proof for the E2E harness: the production app (built with
 * E2E_TEST=1) boots, the home page renders a working ticker search, and a
 * search lands on a server-rendered /AAPL symbol page (data from the seeded
 * asset_translations row + FakeMarketProvider, never a real external API).
 *
 * Selector notes (verified against the real DOM, not the integration test
 * best-guesses in the task brief):
 *   - The ticker input has `role="combobox"` (NOT `searchbox`) with
 *     aria-label "종목 티커 검색" (see features/ticker-search/ui/TickerAutocomplete).
 *   - That combobox is rendered TWICE on the home page — once in the layout
 *     Header (role="banner") and once in the hero SymbolSearchPanel — so an
 *     unscoped getByRole would be a strict-mode (2-element) violation. We scope
 *     to the banner landmark, which is present on every page and stable.
 *   - Enter with no autocomplete item highlighted navigates straight to
 *     `/${query.toUpperCase()}` (useAutocomplete.handleKeyDown), so no dropdown
 *     selection is required.
 *   - The chart page's visible h1 is `${displayName} 차트 분석`; for the seeded
 *     AAPL row displayName contains "AAPL", so `name: /AAPL/` matches.
 */
test.describe('smoke: harness boots and renders', () => {
    test('home loads with the ticker search', async ({ page }) => {
        await page.goto('/');
        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });

    test('search navigates to the symbol page and it renders', async ({
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
