import { test, expect } from '../support/fixtures';

/**
 * E2E spec: Korean-name search for cryptocurrency assets.
 *
 * Proves that typing a Korean coin name prefix (e.g. "비트코") in the header
 * search combobox surfaces the corresponding crypto result (BTCUSD) in the
 * autocomplete dropdown with the "코인" badge.
 *
 * How this works end-to-end:
 *   - seed.ts populates crypto_assets with koreanName='비트코인' for BTCUSD
 *     (and '이더리움' for ETHUSD) so the DB is consistent with the fixture.
 *   - searchTickerAction short-circuits under E2E_TEST=1 and returns a
 *     deterministic fixture that includes BTCUSD/ETHUSD with koreanName and
 *     marketProfile:'crypto'. The filter checks koreanName so "비트코" matches.
 *   - TickerAutocomplete renders a role="option" button per result; when
 *     result.marketProfile === 'crypto' it renders a <CryptoBadge> ("코인").
 *
 * Selector conventions (mirrored from symbol-search.spec.ts):
 *   - Header combobox: role="combobox" aria-label="종목 티커 검색" scoped to
 *     role="banner" to avoid the duplicate hero panel combobox on the home page.
 *   - Autocomplete options: role="option" inside the listbox that appears
 *     after typing. Playwright auto-waits for the option — no sleep needed.
 *   - 코인 badge: text "코인" near the BTCUSD option.
 *
 * Non-flakiness strategy:
 *   - Playwright's built-in auto-waiting on toBeVisible() naturally absorbs the
 *     300ms debounce (useTickerSearch) + server-action round-trip latency.
 *   - No hard sleeps.
 *   - The E2E_TEST fixture is fully deterministic; no real FMP or DB query.
 */

const TICKER_COMBOBOX_NAME = '종목 티커 검색';

test.describe('crypto Korean-name search', () => {
    test('typing a Korean prefix surfaces the crypto result with 코인 badge', async ({
        page,
    }) => {
        await page.goto('/');

        // Use the banner (header) combobox — scoped to role="banner" to avoid
        // the strict-mode violation from the duplicate hero-panel combobox.
        const search = page
            .getByRole('banner')
            .getByRole('combobox', { name: TICKER_COMBOBOX_NAME });

        await search.fill('비트코');

        // The listbox appears after the 300ms debounce. Playwright auto-waits
        // on toBeVisible so no sleep is needed; the default expect timeout
        // (5s local, 15s CI) comfortably covers debounce + server-action time.
        const btcOption = page
            .getByRole('option')
            .filter({ hasText: 'BTCUSD' })
            .first();

        await expect(btcOption).toBeVisible();

        // The CryptoBadge ("코인") must be present inside the BTCUSD option.
        // Use exact:true to match only the badge span (not the substring "코인"
        // that appears inside "비트코인" in the display name).
        await expect(
            btcOption.getByText('코인', { exact: true })
        ).toBeVisible();
    });

    test('clicking the crypto result navigates to /BTCUSD', async ({
        page,
    }) => {
        await page.goto('/');

        // Use the hero-panel combobox (scoped to #search) for the click path
        // so onSelect fires and the navigate() handler routes correctly.
        // (The banner combobox has no onSelect; both navigate via router.push.)
        const search = page
            .getByRole('banner')
            .getByRole('combobox', { name: TICKER_COMBOBOX_NAME });

        await search.fill('비트코');

        const btcOption = page
            .getByRole('option')
            .filter({ hasText: 'BTCUSD' })
            .first();

        await expect(btcOption).toBeVisible();
        await btcOption.click();

        await page.waitForURL('**/BTCUSD');
        await expect(
            page.getByRole('heading', { level: 1, name: /BTCUSD/ })
        ).toBeVisible({ timeout: 15_000 });
    });
});
