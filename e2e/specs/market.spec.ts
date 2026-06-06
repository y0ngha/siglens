import { test, expect } from '../support/fixtures';
import { E2E_FORCE_MARKET_PARTIAL_COOKIE } from '@/shared/api/e2eMarketStub';

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

    /**
     * SSR 크롤 텍스트 보장. 인터랙티브 SectorSignalPanel은 useSearchParams CSR
     * bailout이라 no-JS HTML이 비어 있다. SectorFactsSummary가 Suspense fallback에
     * 같은 데이터를 서버 렌더하므로, JS 없이 받은 raw HTML에 섹션 헤딩이 있어야 한다.
     */
    test('SSR HTML exposes the SectorFactsSummary crawl-text (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/market');
        expect(res.status()).toBe(200);
        const html = await res.text();
        expect(html).toContain('섹터별 신호 모아보기');
    });

    /**
     * 부분 로드 실패 안내. FakeMarketProvider는 항상 비-0 시세를 주므로 안내가 뜨지
     * 않는다 — force-partial 쿠키(E2E_TEST 한정, getMarketSummaryClientAction이 해석;
     * 클라는 NEXT_PUBLIC_E2E_TEST=1일 때 force-partial을 결정적으로 refetch)로 첫 섹터
     * quote를 0으로 만들어 server action → useMarketSummary(hasMissingQuotes) → 패널
     * 안내까지 전 경로를 결정적으로 검증한다. 닫으면(일시적) 사라진다.
     */
    test('partial data-load failure shows a dismissible notice', async ({
        page,
        context,
    }) => {
        await context.addCookies([
            {
                name: E2E_FORCE_MARKET_PARTIAL_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/market');

        const notice = page.getByRole('alert').filter({
            hasText: '미국 증시 데이터를 불러오는 중 일부를 가져오지 못했어요.',
        });
        await expect(notice).toBeVisible();

        await notice.getByRole('button', { name: '안내 닫기' }).click();

        await expect(notice).toHaveCount(0);
    });
});
