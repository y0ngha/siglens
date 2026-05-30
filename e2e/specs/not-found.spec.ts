import { test, expect } from '../support/fixtures';

/**
 * Not-found handling (`/`) — Tier 4 cross-cutting outcome.
 *
 * Two ways to reach the global not-found.tsx:
 *   - an unknown route segment (no matching page), and
 *   - a malformed ticker: `/[symbol]/page.tsx` calls `notFound()` when the
 *     segment fails VALID_TICKER_RE (/^[A-Z][A-Z.-]{0,7}$/). A well-FORMED but
 *     unseeded ticker would instead render (FakeMarketProvider serves any symbol
 *     under E2E), so we deliberately use a regex-failing ticker here.
 *
 * We assert the user-facing OUTCOME — the not-found page renders with a working
 * home link — rather than the raw HTTP status: `/[symbol]` renders dynamically,
 * so notFound() lands inside an already-committed (streamed) shell, which makes
 * the response status an unreliable implementation detail here.
 */
const NOT_FOUND_URLS = [
    '/this-route-does-not-exist-zzz',
    '/INVALIDTICKER1', // >8 chars + digit → fails VALID_TICKER_RE → notFound()
] as const;

test.describe('not found', () => {
    for (const url of NOT_FOUND_URLS) {
        test(`${url} renders the not-found page with a home link`, async ({
            page,
        }) => {
            await page.goto(url);

            await expect(
                page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })
            ).toBeVisible();

            const homeLink = page.getByRole('link', {
                name: /홈으로 돌아가기/,
            });
            await expect(homeLink).toBeVisible();
            await expect(homeLink).toHaveAttribute('href', '/');
        });
    }

    test('the not-found home link navigates back to the landing page', async ({
        page,
    }) => {
        await page.goto('/this-route-does-not-exist-zzz');
        await page.getByRole('link', { name: /홈으로 돌아가기/ }).click();
        await page.waitForURL('**/');
        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });
});
