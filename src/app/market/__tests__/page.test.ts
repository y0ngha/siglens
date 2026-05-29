vi.mock('@tanstack/react-query', () => ({
    dehydrate: vi.fn(),
    HydrationBoundary: () => null,
    QueryClient: vi.fn().mockImplementation(() => ({
        prefetchQuery: vi.fn(),
    })),
}));
vi.mock('@/widgets/dashboard/MarketSummaryPanel', () => ({
    MarketSummaryPanel: () => null,
}));
vi.mock('@/widgets/dashboard/MarketSummaryPanelSkeleton', () => ({
    MarketSummaryPanelSkeleton: () => null,
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
vi.mock('@/entities/sector-signal/actions', () => ({
    getSectorSignalsAction: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/entities/market-summary/actions', () => ({
    getMarketSummaryAction: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/shared/config/dashboard-tickers', () => ({
    DASHBOARD_TIMEFRAMES: ['1Day', '1Week'],
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: 'AI 반도체', sectorName: 'Technology' },
    ],
}));
vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: { marketSummary: () => ['marketSummary'] },
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

import { generateMetadata } from '@/app/market/page';

describe('Market page', () => {
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
});
