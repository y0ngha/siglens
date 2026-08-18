// Mock all server/client dependencies before any imports

const mockSetQueryData = vi.fn();
// QueryClient must remain a proper constructor (class/function) so `new QueryClient()` in
// MarketContent does not throw "not a constructor". An arrow function in vi.mock would break this.
function MockQueryClientClass() {
    return { setQueryData: mockSetQueryData };
}

vi.mock('@tanstack/react-query', () => ({
    dehydrate: vi.fn(() => ({})),
    HydrationBoundary: () => null,
    QueryClient: MockQueryClientClass,
}));

vi.mock('@/widgets/dashboard/MarketSummaryPanel', () => ({
    MarketSummaryPanel: () => null,
}));
vi.mock('@/widgets/dashboard/MarketSummaryPanelSkeleton', () => ({
    MarketSummaryPanelSkeleton: () => null,
}));
vi.mock('@/widgets/dashboard/SectorFactsSummary', () => ({
    SectorFactsSummary: () => null,
}));
vi.mock('@/widgets/dashboard/SectorSignalPanel', () => ({
    SectorSignalPanel: () => null,
}));
vi.mock('@/widgets/dashboard/SectorSignalPanelSkeleton', () => ({
    SectorSignalPanelSkeleton: () => null,
}));
vi.mock('@/widgets/dashboard/SignalTypeGuide', () => ({
    SignalTypeGuide: () => null,
}));

const mockGetMarketSummaryStatic = vi.fn().mockResolvedValue({
    indices: [],
    sectors: [],
});
vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: (...args: unknown[]) =>
        mockGetMarketSummaryStatic(...args),
}));

const mockPeekBriefingStatic = vi.fn().mockResolvedValue(null);
vi.mock('@/entities/market-summary/api/briefingStaticCache', () => ({
    peekBriefingStatic: (...args: unknown[]) => mockPeekBriefingStatic(...args),
}));

// Intentionally includes minutes/seconds to verify quantization strips them off
const mockGetSectorSignalsStatic = vi.fn().mockResolvedValue({
    computedAt: '2026-06-04T14:37:22.000Z',
    stocks: [],
});
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: (...args: unknown[]) =>
        mockGetSectorSignalsStatic(...args),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
    // `dashboardScope`가 이 모듈에서 US 설정을 조립하므로 목이 전부를 덮어야 한다.
    // 하나라도 빠지면 scope 생성 단계에서 터진다.
    MARKET_INDICES: [
        {
            symbol: 'GSPC',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: '미국 대형주 500',
        },
    ],
    SECTOR_ETFS: [
        { symbol: 'XLK', koreanName: 'AI 반도체', sectorName: 'Technology' },
    ],
    SECTOR_GROUPS: [{ label: '성장', symbols: ['XLK'] }],
    SECTOR_STOCKS: [
        { symbol: 'AAPL', koreanName: '애플', sectorSymbol: 'XLK' },
    ],
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: 'AI 반도체', sectorName: 'Technology' },
    ],
}));

vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: {
        marketSummary: (scope: string) => ['market-summary', scope],
        sectorSignals: (scope: string, tf: string) => [
            'sector-signals',
            scope,
            tf,
        ],
        marketBriefing: (scope: string) => ['market-briefing', scope],
    },
}));

vi.mock('@/shared/lib/seo', () => ({
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    clampSeoDescription: (text: string) => text,
    ROOT_KEYWORDS: ['주식'],
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));

vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));

import * as pageModule from '@/app/market/page';
import { generateMetadata } from '@/app/market/page';
// `MarketContent`는 미국·한국 라우트가 공유하는 본문으로 옮겨졌다 — scope를 인자로 받는다.
import { MarketContent } from '@/app/market/MarketRouteBody';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

describe('Market page', () => {
    describe('ISR route config', () => {
        it('exports revalidate = 3600 (literal — required for Next.js static analysis)', () => {
            // MISTAKES §15: route segment config must be a literal, not an imported constant
            expect(pageModule.revalidate).toBe(3600);
        });

        it('does NOT export generateStaticParams (static route, not dynamic segment)', () => {
            // /market is a static route — generateStaticParams is only for [param] routes
            expect(
                (pageModule as Record<string, unknown>).generateStaticParams
            ).toBeUndefined();
        });
    });

    describe('generateMetadata', () => {
        // 두 loader 모두 콘텐츠가 있는 정상 상태. 모듈 기본 mock(둘 다 빈 배열)은
        // degrade 판정 테스트 쪽에서 그대로 재사용한다.
        beforeEach(() => {
            mockGetMarketSummaryStatic.mockResolvedValue({
                indices: [{ symbol: 'GSPC' }],
                sectors: [{ symbol: 'XLK' }],
            });
            mockGetSectorSignalsStatic.mockResolvedValue({
                computedAt: '2026-06-04T14:37:22.000Z',
                stocks: [{ symbol: 'AAPL' }],
            });
        });

        it('returns metadata with market title', async () => {
            const metadata = await generateMetadata();
            expect(metadata.title).toContain('미국 주식');
        });

        it('sets canonical to /market when at least one loader has data', async () => {
            const metadata = await generateMetadata();
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/market'
            );
        });

        it('does not set noindex — variant URLs consolidate via clean canonical', async () => {
            const metadata = await generateMetadata();
            expect(metadata.robots).toBeUndefined();
        });

        /**
         * 회귀 가드(SEO 감사 라운드 2 finding 4): `/market`은 두 loader(summary/sector)가
         * 모두 빈 값으로 떨어져도 canonical=/market + robots=undefined를 냈다 — 본문은
         * MarketSummaryPanel/SectorSignalPanel이 빈 배열로 non-empty degraded view를
         * 렌더하는데(의도된 graceful fallback), 그 상태를 그대로 색인시키고 있었다.
         * economy/fear-greed 형제 페이지와 동일하게 canonical=null + noindex로 gate한다.
         */
        it('두 loader가 모두 빈 값이면 canonical=null + noindex', async () => {
            mockGetMarketSummaryStatic.mockResolvedValue({
                indices: [],
                sectors: [],
            });
            mockGetSectorSignalsStatic.mockResolvedValue({
                computedAt: '',
                stocks: [],
            });

            const metadata = await generateMetadata();

            expect(metadata.alternates?.canonical).toBeNull();
            expect(metadata.robots).toEqual({ index: false, follow: true });
        });

        it('한 loader만 비어도 다른 loader에 데이터가 있으면 degrade로 보지 않는다', async () => {
            mockGetMarketSummaryStatic.mockResolvedValue({
                indices: [],
                sectors: [],
            });
            // sectorData는 beforeEach의 non-empty 값을 그대로 유지.

            const metadata = await generateMetadata();

            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/market'
            );
            expect(metadata.robots).toBeUndefined();
        });

        it('두 loader가 모두 throw해도 degrade 경로로 폴백해 canonical=null + noindex', async () => {
            mockGetMarketSummaryStatic.mockRejectedValue(new Error('FMP 5xx'));
            mockGetSectorSignalsStatic.mockRejectedValue(
                new Error('cache miss')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const metadata = await generateMetadata();

            expect(metadata.alternates?.canonical).toBeNull();
            expect(metadata.robots).toEqual({ index: false, follow: true });

            consoleSpy.mockRestore();
        });
    });

    describe('MarketContent — static prefetch', () => {
        beforeEach(() => {
            mockGetMarketSummaryStatic.mockResolvedValue({
                indices: [],
                sectors: [],
            });
            mockGetSectorSignalsStatic.mockResolvedValue({
                // Intentionally includes minutes/seconds to verify quantization strips them off
                computedAt: '2026-06-04T14:37:22.000Z',
                stocks: [],
            });
            mockPeekBriefingStatic.mockResolvedValue(null);
            mockSetQueryData.mockClear();
        });

        it('calls getMarketSummaryStatic (no args — static route)', async () => {
            await MarketContent({ scope: US_DASHBOARD_SCOPE });
            expect(mockGetMarketSummaryStatic).toHaveBeenCalled();
        });

        it('calls getSectorSignalsStatic with DEFAULT_DASHBOARD_TIMEFRAME', async () => {
            await MarketContent({ scope: US_DASHBOARD_SCOPE });
            expect(mockGetSectorSignalsStatic).toHaveBeenCalledWith(
                US_DASHBOARD_SCOPE,
                '1Day'
            );
        });

        it('seeds QueryClient with setQueryData for both marketSummary and sectorSignals keys', async () => {
            await MarketContent({ scope: US_DASHBOARD_SCOPE });

            // MarketContent calls queryClient.setQueryData twice: once for marketSummary
            // and once for sectorSignals. mockSetQueryData is shared across all QueryClient
            // instances created by MockQueryClientClass.
            // page.tsx: queryClient.setQueryData(QUERY_KEYS.marketSummary(), { summary }, { updatedAt })
            // updatedAt 옵션은 dehydrate 시 ISR HTML 결정성 보장용(2026-06-06 PR #573 R8 fix).
            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['market-summary', 'us'],
                expect.objectContaining({
                    summary: expect.objectContaining({
                        indices: [],
                        sectors: [],
                    }),
                }),
                expect.objectContaining({ updatedAt: expect.any(Number) })
            );
            // page.tsx: queryClient.setQueryData(QUERY_KEYS.sectorSignals(...), sectorData, { updatedAt })
            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['sector-signals', 'us', '1Day'],
                expect.objectContaining({ stocks: [] }),
                expect.objectContaining({ updatedAt: expect.any(Number) })
            );
        });

        it('SSR seed quantizes sectorData.computedAt to hour bucket — raw minutes/seconds are stripped', async () => {
            // page.tsx는 raw computedAt이 아니라 `new Date().toISOString().slice(0, 13)` 즉
            // SSR 렌더 시점의 시간 버킷으로 교체한다 — vi.setSystemTime으로 시간 고정 후 exact 검증.
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-06-04T14:37:22.000Z'));
            try {
                await MarketContent({ scope: US_DASHBOARD_SCOPE });

                const sectorSignalsCall = (
                    mockSetQueryData.mock.calls as [
                        unknown[],
                        unknown,
                        unknown,
                    ][]
                ).find(
                    ([key]) => Array.isArray(key) && key[0] === 'sector-signals'
                );
                expect(sectorSignalsCall).toBeDefined();
                const seededData = sectorSignalsCall![1] as {
                    computedAt: string;
                };

                // Exact: 고정된 system time → '2026-06-04T14' (13 chars, no minutes)
                expect(seededData.computedAt).toBe('2026-06-04T14');

                // updatedAt 옵션도 결정론적: dateHour:00:00 ms = '2026-06-04T14:00:00.000Z'
                const expectedUpdatedAt = new Date(
                    '2026-06-04T14:00:00.000Z'
                ).getTime();
                expect(sectorSignalsCall![2]).toEqual({
                    updatedAt: expectedUpdatedAt,
                });
            } finally {
                vi.useRealTimers();
            }
        });

        it('SSR seed quantization works when stocks is empty', async () => {
            mockGetSectorSignalsStatic.mockResolvedValue({
                computedAt: '2026-06-04T09:52:11.000Z',
                stocks: [],
            });
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-06-04T09:52:11.000Z'));
            try {
                await MarketContent({ scope: US_DASHBOARD_SCOPE });

                const sectorSignalsCall = (
                    mockSetQueryData.mock.calls as [unknown[], unknown][]
                ).find(
                    ([key]) => Array.isArray(key) && key[0] === 'sector-signals'
                );
                expect(sectorSignalsCall).toBeDefined();
                const seededData = sectorSignalsCall![1] as {
                    computedAt: string;
                    stocks: unknown[];
                };

                expect(seededData.stocks).toEqual([]);
                // Exact: fixed system time → '2026-06-04T09'
                expect(seededData.computedAt).toBe('2026-06-04T09');
            } finally {
                vi.useRealTimers();
            }
        });

        it('peekBriefingStatic returns null → graceful fallback (client triggers submit)', async () => {
            mockPeekBriefingStatic.mockResolvedValue(null);
            // MarketContent must render without throwing when peekSeed is null
            await expect(
                MarketContent({ scope: US_DASHBOARD_SCOPE })
            ).resolves.toBeDefined();
        });

        it('peekBriefingStatic throwing → .catch(() => null) prevents page crash', async () => {
            // The page uses .catch(() => null) — even if peekBriefingStatic throws,
            // peekSeed = null and the page continues to render. This test would FAIL
            // if the page's own .catch were removed, because MarketContent({ scope: US_DASHBOARD_SCOPE }) would reject.
            mockPeekBriefingStatic.mockRejectedValue(new Error('redis down'));
            await expect(
                MarketContent({ scope: US_DASHBOARD_SCOPE })
            ).resolves.toBeDefined();
        });

        it('getMarketSummaryStatic throwing → .catch() degraded empty summary, page does not throw', async () => {
            // ISR 빈 캐시 동결 방지: summary loader throw 시 { indices: [], sectors: [] }로
            // 폴백해 MarketContent가 non-empty 결과를 반환해야 한다.
            mockGetMarketSummaryStatic.mockRejectedValue(new Error('FMP 5xx'));
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            await expect(
                MarketContent({ scope: US_DASHBOARD_SCOPE })
            ).resolves.toBeDefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[MarketContent:us] getMarketSummaryStatic failed:'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('getSectorSignalsStatic throwing → .catch() degraded empty stocks, page does not throw', async () => {
            // ISR 빈 캐시 동결 방지: signals loader throw 시 { computedAt, stocks: [] }로
            // 폴백해 MarketContent가 non-empty 결과를 반환해야 한다.
            mockGetSectorSignalsStatic.mockRejectedValue(
                new Error('cache miss')
            );
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            await expect(
                MarketContent({ scope: US_DASHBOARD_SCOPE })
            ).resolves.toBeDefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[MarketContent:us] getSectorSignalsStatic failed:'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('page structure — no searchParams dependency', () => {
        it('MarketPage default export does not accept searchParams prop', () => {
            // Verify the function signature has no searchParams parameter
            const MarketPage = pageModule.default;
            // A 0-arity function (no required params) → ISR-safe
            expect(MarketPage.length).toBe(0);
        });
    });
});

/**
 * 이 파일은 `buildBreadcrumbJsonLd`를 `{}`로 목킹해서 렌더된 JSON-LD로는 이름을
 * 볼 수 없다. 그래서 **호출 인자**로 고정한다 — breadcrumb 이름은 SERP에 실제로
 * 출력되는 문자열이고, 여기가 유일한 관측점이다.
 */
describe('/market BreadcrumbList 이름', () => {
    it('시장을 명시한다', async () => {
        const { buildBreadcrumbJsonLd } = await import('@/shared/lib/seo');
        // 라우트는 이제 공유 본문 컴포넌트를 반환만 한다 — breadcrumb는 그 본문이
        // 렌더될 때 만들어지므로 본문을 직접 호출해야 관측된다.
        const { MarketRouteBody } = await import('../MarketRouteBody');
        vi.mocked(buildBreadcrumbJsonLd).mockClear();
        MarketRouteBody({ scope: US_DASHBOARD_SCOPE });
        expect(buildBreadcrumbJsonLd).toHaveBeenCalledWith([
            expect.objectContaining({ name: '미국 시장 현황' }),
        ]);
    });
});
