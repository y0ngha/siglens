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

const mockGetSectorSignalsStatic = vi.fn().mockResolvedValue({
    computedAt: '2026-06-04T00:00:00Z',
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
                computedAt: '2026-06-04T00:00:00Z',
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
            // page.tsx: queryClient.setQueryData(QUERY_KEYS.marketSummary(), { summary })
            // → data shape is { summary: { indices, sectors } }
            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['market-summary'],
                expect.objectContaining({
                    summary: expect.objectContaining({
                        indices: [],
                        sectors: [],
                    }),
                })
            );
            // page.tsx: queryClient.setQueryData(QUERY_KEYS.sectorSignals(...), sectorData)
            // → data shape is { computedAt, stocks }
            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['sector-signals', '1Day'],
                expect.objectContaining({ stocks: [] })
            );
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
