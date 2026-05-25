vi.mock('@/widgets/symbol-page/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    FALLBACK_ANALYSIS: { summary: 'fallback' },
}));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: vi.fn().mockReturnValue(false),
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoCached: vi.fn(),
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn().mockResolvedValue({ bars: [] }),
}));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
    }),
}));
vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: {
        assetInfo: (s: string) => ['assetInfo', s],
        bars: (s: string, t: string) => ['bars', s, t],
    },
    QUERY_STALE_TIME_MS: 5000,
}));
vi.mock('@/shared/lib/seo', () => ({
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 차트',
        fullTitle: 'AAPL 차트 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@tanstack/react-query', () => ({
    dehydrate: vi.fn().mockReturnValue({}),
    HydrationBoundary: () => null,
    QueryClient: vi.fn().mockImplementation(() => ({
        setQueryData: vi.fn(),
        prefetchQuery: vi.fn(),
    })),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { generateMetadata } from '@/app/[symbol]/page';
import { getAssetInfoCached } from '@/entities/ticker';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoCached = getAssetInfoCached as MockedFunction<
    typeof getAssetInfoCached
>;

describe('Symbol page', () => {
    describe('generateMetadata', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('returns noindex for invalid ticker', async () => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '!!!invalid' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.robots).toEqual(
                expect.objectContaining({ index: false })
            );
        });

        it('returns metadata with title for valid ticker', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.title).toBe('AAPL 차트');
        });

        it('adds noindex when tf query param is present', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({ tf: '1Hour' }),
            });

            expect(metadata.robots).toEqual(
                expect.objectContaining({ index: false })
            );
        });

        it('does not add noindex when no tf param', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.robots).toBeUndefined();
        });
    });
});
