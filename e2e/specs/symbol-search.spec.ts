import { test, expect } from '../support/fixtures';

/**
 * Dedicated ticker-search spec: proves the three user-visible search outcomes
 * against the production build (E2E_TEST=1) with zero external browser requests
 * (the support/fixtures network guard enforces this).
 *
 * Selector / behavior notes (verified against the real DOM + runtime probe,
 * NOT the unit-test mocks in src/__integration__/recentSearches.test.tsx):
 *
 *   - The ticker input is `role="combobox"` with aria-label "종목 티커 검색"
 *     (features/ticker-search/ui/TickerAutocomplete). It is rendered TWICE on
 *     the home page: once in the layout Header (role="banner", size="sm", no
 *     onSelect) and once in the hero SymbolSearchPanel (size="lg",
 *     onSelect={addSearch}). An unscoped getByRole would be a strict-mode
 *     (2-element) violation, so every combobox lookup is landmark-/region-
 *     scoped.
 *
 *   - RECENT-SEARCH RECORDING is wired ONLY on the hero panel's autocomplete
 *     (`<TickerAutocomplete onSelect={addSearch} />` in SymbolSearchPanel) — the
 *     banner copy has no onSelect, so a banner search does NOT record a recent.
 *     `addSearch` → addRecentSearch persists an uppercase-normalized symbol to
 *     localStorage key `siglens:recent-searches`. Both the Enter-navigate path
 *     and the dropdown-option click path go through useAutocomplete.navigate(),
 *     which fires onSelect before router.push — so a HERO search records the
 *     symbol. The recent chip renders back on `/` as a `<Link>` (role="link",
 *     accessible name = the ticker) inside the `#search` hero region, alongside
 *     a "최근 검색" header.
 *
 *   - AUTOCOMPLETE IS AVAILABLE under E2E (verified by probe): typing `aapl`
 *     returns a populated role="listbox" (#ticker-autocomplete-listbox) with
 *     real options (AAPL + AAPL-derivative ETFs), so we can exercise the
 *     dropdown-click path, not only Enter-navigate. The brief's worry that the
 *     dropdown would be empty under E2E did not materialize — the search action
 *     resolves enough to return matches in this environment.
 *
 *   - The seeded AAPL symbol page's visible h1 is `${displayName} 차트 분석`,
 *     where displayName contains "AAPL", so `name: /AAPL/` matches.
 */

const TICKER_COMBOBOX_NAME = '종목 티커 검색';

test.describe('symbol search', () => {
    test('Enter on the banner search navigates to the symbol page', async ({
        page,
    }) => {
        await page.goto('/');

        const search = page
            .getByRole('banner')
            .getByRole('combobox', { name: TICKER_COMBOBOX_NAME });
        await search.fill('aapl');
        await search.press('Enter');

        await page.waitForURL('**/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible();
    });

    test('selecting an autocomplete option navigates to that symbol', async ({
        page,
    }) => {
        await page.goto('/');

        // Scope to the hero search region so the duplicate banner combobox
        // does not trip strict mode.
        const search = page
            .locator('#search')
            .getByRole('combobox', { name: TICKER_COMBOBOX_NAME });
        await search.fill('aapl');

        // The autocomplete dropdown is a role="listbox"; under E2E it returns
        // real matches. Click the exact AAPL option (role="option") — Playwright
        // auto-waits for it to appear, so no arbitrary sleep is needed.
        const aaplOption = page
            .getByRole('option')
            .filter({ hasText: 'AAPL' })
            .first();
        await aaplOption.click();

        await page.waitForURL('**/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible();
    });

    test('recent searches persist across navigation', async ({ page }) => {
        await page.goto('/');

        // Search from the HERO panel (the one wired with onSelect={addSearch}),
        // so the search is recorded to localStorage. Enter-navigate goes through
        // navigate() → onSelect(addSearch) before router.push.
        const heroSearch = page
            .locator('#search')
            .getByRole('combobox', { name: TICKER_COMBOBOX_NAME });
        await heroSearch.fill('aapl');
        await heroSearch.press('Enter');
        await page.waitForURL('**/AAPL');

        // Return to home: the recent-search chip must have persisted (proves
        // localStorage survived the navigation away and back). Scope to the
        // hero `#search` region — the home page has another (popular-ticker)
        // AAPL link outside it, so an unscoped lookup would hit two elements.
        await page.goto('/');

        await expect(
            page.locator('#search').getByText('최근 검색')
        ).toBeVisible();

        const recentChip = page
            .locator('#search')
            .getByRole('link', { name: 'AAPL' });
        await expect(recentChip).toBeVisible();
        await expect(recentChip).toHaveAttribute('href', '/AAPL');

        // The chip's remove control is present and correctly labeled, confirming
        // this is the recent-searches UI (not an unrelated AAPL link).
        await expect(
            page.getByRole('button', { name: 'AAPL 최근 검색에서 제거' })
        ).toBeVisible();
    });
});
