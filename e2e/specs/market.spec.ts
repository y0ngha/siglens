import { test, expect } from '../support/fixtures';

/**
 * Market overview (`/market`) — Tier 3 render outcomes.
 *
 * The page's identifying h1 (MARKET_TITLE) is RSC-emitted and data-independent.
 * The sector-signal scanner below it IS data-backed (FakeMarketProvider under
 * E2E), so we assert its stable landmark — the "섹터별 신호 모아보기" region/heading
 * from SectorSignalPanel — rather than any specific scanned ticker, which would
 * be brittle. The panel may render a skeleton or fixture-backed rows; either way
 * its labelled region is present.
 */
test.describe('market overview', () => {
    test('renders the market title and the sector-signal scanner', async ({
        page,
    }) => {
        await page.goto('/market');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: '오늘의 미국 주식, 섹터별 기술적 신호',
            })
        ).toBeVisible();

        await expect(
            page.getByRole('region', { name: '섹터별 신호 모아보기' })
        ).toBeVisible();
    });
});
