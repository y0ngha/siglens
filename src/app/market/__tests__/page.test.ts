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
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: 'AI 반도체', sectorName: 'Technology' },
    ],
}));

vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: {
        marketSummary: () => ['market-summary'],
        sectorSignals: (tf: string) => ['sector-signals', tf],
        marketBriefing: () => ['market-briefing'],
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
import { generateMetadata, MarketContent } from '@/app/market/page';

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
        it('returns metadata with market title', async () => {
            const metadata = await generateMetadata();
            expect(metadata.title).toContain('미국 주식');
        });

        it('sets canonical to /market', async () => {
            const metadata = await generateMetadata();
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/market'
            );
        });

        it('does not set noindex — variant URLs consolidate via clean canonical', async () => {
            const metadata = await generateMetadata();
            expect(metadata.robots).toBeUndefined();
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
            await MarketContent();
            expect(mockGetMarketSummaryStatic).toHaveBeenCalled();
        });

        it('calls getSectorSignalsStatic with DEFAULT_DASHBOARD_TIMEFRAME', async () => {
            await MarketContent();
            expect(mockGetSectorSignalsStatic).toHaveBeenCalledWith('1Day');
        });

        it('seeds QueryClient with setQueryData for both marketSummary and sectorSignals keys', async () => {
            await MarketContent();

            // MarketContent calls queryClient.setQueryData twice: once for marketSummary
            // and once for sectorSignals. mockSetQueryData is shared across all QueryClient
            // instances created by MockQueryClientClass.
            // page.tsx: queryClient.setQueryData(QUERY_KEYS.marketSummary(), { summary }, { updatedAt })
            // updatedAt 옵션은 dehydrate 시 ISR HTML 결정성 보장용(2026-06-06 PR #573 R8 fix).
            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['market-summary'],
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
                ['sector-signals', '1Day'],
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
                await MarketContent();

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
                await MarketContent();

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
            await expect(MarketContent()).resolves.toBeDefined();
        });

        it('peekBriefingStatic throwing → .catch(() => null) prevents page crash', async () => {
            // The page uses .catch(() => null) — even if peekBriefingStatic throws,
            // peekSeed = null and the page continues to render. This test would FAIL
            // if the page's own .catch were removed, because MarketContent() would reject.
            mockPeekBriefingStatic.mockRejectedValue(new Error('redis down'));
            await expect(MarketContent()).resolves.toBeDefined();
        });

        it('getMarketSummaryStatic throwing → .catch() degraded empty summary, page does not throw', async () => {
            // ISR 빈 캐시 동결 방지: summary loader throw 시 { indices: [], sectors: [] }로
            // 폴백해 MarketContent가 non-empty 결과를 반환해야 한다.
            mockGetMarketSummaryStatic.mockRejectedValue(new Error('FMP 5xx'));
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            await expect(MarketContent()).resolves.toBeDefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[MarketContent] getMarketSummaryStatic failed:'
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

            await expect(MarketContent()).resolves.toBeDefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[MarketContent] getSectorSignalsStatic failed:'
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
