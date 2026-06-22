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
 *     short-circuits to the seeded AAPL row under E2E, never a real API);
 *   - hero quick-links (마켓 뉴스 / 미국 경제) navigate to the correct routes.
 *     The same labels exist in the header nav and footer, so these queries are
 *     scoped to `main` to exclude those copies.
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
                name: /AI가 분석하고 완성하는 SIGLENS/,
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

    /**
     * Hero quick-links — 마켓 뉴스·미국 경제 링크 클릭 시 올바른 URL로 이동한다.
     *
     * 동일 레이블이 헤더 nav와 푸터에도 존재하므로, `main` 랜드마크로 범위를 제한해
     * 그 사본들과 충돌하지 않도록 한다. 각 검사는 홈에서 새로 시작해 이전 탐색
     * 상태가 이후 링크 조회에 영향을 주지 않게 한다.
     */
    test('히어로 퀵링크로 마켓 뉴스·미국 경제로 이동한다', async ({ page }) => {
        // (a) 마켓 뉴스 → /news
        await page.goto('/');
        const main = page.getByRole('main');

        // → is wrapped in <span aria-hidden="true">, so it is excluded from the
        // accessible name. The exact accessible name is '마켓 뉴스' / '미국 경제'.
        await main.getByRole('link', { name: '마켓 뉴스' }).click();
        await page.waitForURL('**/news');

        // (b) 미국 경제 → /economy
        await page.goto('/');
        await page
            .getByRole('main')
            .getByRole('link', { name: '미국 경제' })
            .click();
        await page.waitForURL('**/economy');
    });
});
