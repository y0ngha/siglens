/**
 * Fear-greed page crypto-branch tests.
 *
 * Verifies two call sites added during the crypto audit:
 *   (a) buildAssetAboutNode receives assetClass 'crypto' for a crypto asset,
 *       causing the about node to be omitted from the JSON-LD output.
 *   (b) quantizeBarsDataToLastClosed is called with CRYPTO_SESSION ({kind:'always-open'})
 *       for crypto and US_EQUITY_SESSION for equity.
 *
 * Mirrors the mocking style of src/app/[symbol]/__tests__/layout.test.tsx.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const {
    mockSetQueryData,
    mockGetAssetInfoResilient,
    mockGetBarsStatic,
    mockQuantize,
    mockBuildAssetAboutNode,
} = vi.hoisted(() => ({
    mockSetQueryData: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetBarsStatic: vi.fn(),
    mockQuantize: vi.fn(),
    mockBuildAssetAboutNode: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    US_EQUITY_SESSION: {
        kind: 'scheduled' as const,
        timeZone: 'America/New_York',
        openMinute: 570,
        closeMinute: 960,
        weekendDays: [0, 6],
    },
    CRYPTO_SESSION: { kind: 'always-open' as const },
}));

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    HydrationBoundary: () => null,
    QueryClient: function MockQueryClientClass() {
        return { setQueryData: mockSetQueryData };
    },
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: (
        symbol: string,
        name: string,
        fmpSymbol?: string,
        assetClass?: string
    ) => mockBuildAssetAboutNode(symbol, name, fmpSymbol, assetClass),
    buildDisplayName: vi.fn().mockReturnValue('Bitcoin USD'),
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars', () => ({
    getBarsStatic: (symbol: string, timeframe: string, fmpSymbol?: string) =>
        mockGetBarsStatic(symbol, timeframe, fmpSymbol),
    // Capture all 3 args (data, now, session) so tests can assert session threading.
    quantizeBarsDataToLastClosed: (
        data: unknown,
        now: Date,
        session?: unknown
    ) => mockQuantize(data, now, session),
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/widgets/fear-greed/FearGreedPage', () => ({
    FearGreedPage: () => null,
}));
vi.mock('@/widgets/fear-greed', () => ({
    FearGreedPageError: () => null,
}));
vi.mock('@/views/symbol', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    resolveSymbolFearGreedSeoContent: vi
        .fn()
        .mockReturnValue({ fullTitle: '', description: '', url: '' }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
    NOINDEX_SYMBOL_METADATA: {
        robots: { index: false, follow: false },
        alternates: { canonical: null },
    },
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import SymbolFearGreedPage from '@/app/[symbol]/fear-greed/page';

const LAST_BAR_TIME = 1717718400;
const RAW_BARS = {
    bars: [{ time: 1717632000 }, { time: LAST_BAR_TIME }],
    indicators: {},
};
const QUANTIZED = { bars: [{ time: LAST_BAR_TIME }], indicators: {} };

const CRYPTO_ASSET_INFO = {
    symbol: 'BTCUSD',
    name: 'Bitcoin USD',
    fmpSymbol: 'BTCUSD',
    marketProfile: 'crypto' as const,
};

const EQUITY_ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    // marketProfile intentionally absent (legacy equity → defaults to us-equity)
};

describe('SymbolFearGreedPage — crypto branching', () => {
    beforeEach(() => {
        mockSetQueryData.mockClear();
        mockGetAssetInfoResilient.mockReset();
        mockGetBarsStatic.mockReset();
        mockQuantize.mockReset();
        mockBuildAssetAboutNode.mockReset();
        mockGetBarsStatic.mockResolvedValue(RAW_BARS);
        mockQuantize.mockReturnValue(QUANTIZED);
        // Default: about node returns undefined (crypto / non-stock).
        mockBuildAssetAboutNode.mockReturnValue(undefined);
    });

    it('(a) crypto asset → buildAssetAboutNode receives assetClass "crypto"', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: CRYPTO_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        // The page resolves assetClass via getDescriptor(marketProfileOf(assetInfo)).
        // For marketProfile:'crypto', assetClass === 'crypto'.
        // buildAssetAboutNode must receive 'crypto' as the 4th argument.
        expect(mockBuildAssetAboutNode).toHaveBeenCalledWith(
            'BTCUSD',
            expect.any(String), // name (from buildDisplayName mock)
            'BTCUSD',
            'crypto'
        );
    });

    it('(a) equity asset → buildAssetAboutNode receives assetClass "equity"', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // For assetInfo without marketProfile (legacy equity), marketProfileOf returns
        // 'us-equity' → getDescriptor gives assetClass 'equity'.
        expect(mockBuildAssetAboutNode).toHaveBeenCalledWith(
            'AAPL',
            expect.any(String),
            'AAPL',
            'equity'
        );
    });

    it('(b) crypto asset → quantizeBarsDataToLastClosed called with CRYPTO_SESSION ({kind:"always-open"})', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: CRYPTO_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        // sessionSpecFor(marketProfileOf(cryptoAssetInfo)) must resolve to CRYPTO_SESSION.
        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date), {
            kind: 'always-open',
        });
    });

    it('(b) equity asset → quantizeBarsDataToLastClosed called with US_EQUITY_SESSION', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        // sessionSpecFor(marketProfileOf(equityAssetInfo)) must resolve to US_EQUITY_SESSION.
        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date), {
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });
    });
});
