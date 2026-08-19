/**
 * Fear-greed page crypto-branch tests.
 *
 * Verifies two call sites added during the crypto audit:
 *   (a) buildAssetAboutNode receives assetClass 'crypto' for a crypto asset,
 *       causing the about node to be omitted from the JSON-LD output.
 *   (b) getQuantizedBarsStatic receives the right marketProfile string
 *       ('crypto' / 'us-equity'). 세션 spec 매핑 자체는 그 헬퍼 내부 책임이라
 *       src/entities/bars/__tests__/lib/barsStaticCache.test.ts가 검증한다.
 *
 * Mirrors the mocking style of src/app/[symbol]/__tests__/layout.test.tsx.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const {
    mockSetQueryData,
    mockGetAssetInfoResilient,
    mockBuildAssetAboutNode,
    mockGetQuantizedBarsStatic,
} = vi.hoisted(() => ({
    mockSetQueryData: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockBuildAssetAboutNode: vi.fn(),
    mockGetQuantizedBarsStatic: vi.fn(),
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
    // 세션 spec 유도는 이제 헬퍼 내부 책임이라 여기서는 위임 인자
    // (ticker, timeframe, marketProfile, fmpSymbol)만 포착한다.

    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
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
    SymbolPageHeading: () => null,
    FearGreedFactsSummary: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
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
import SymbolFearGreedPage from '@/app/[locale]/[symbol]/fear-greed/page';

const LAST_BAR_TIME = 1717718400;
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
        mockGetQuantizedBarsStatic.mockReset();
        mockBuildAssetAboutNode.mockReset();
        mockGetQuantizedBarsStatic.mockResolvedValue(QUANTIZED);
        // Default: about node returns undefined (crypto / non-stock).
        mockBuildAssetAboutNode.mockReturnValue(undefined);
    });

    it('(a) crypto asset → buildAssetAboutNode receives assetClass "crypto"', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: CRYPTO_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
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
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
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

    it('(b) crypto asset → 헬퍼에 marketProfile "crypto"를 넘긴다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: CRYPTO_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        // 세션 매핑(crypto → always-open)은 `getQuantizedBarsStatic` 내부 책임으로
        // 옮겨졌다(barsStaticCache.test.ts가 검증). 여기서는 페이지가 crypto
        // marketProfile을 헬퍼에 정확히 넘기는지만 본다.
        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'BTCUSD',
            '1Day',
            'crypto',
            expect.anything()
        );
    });

    it('(b) equity asset → 헬퍼에 marketProfile "us-equity"를 넘긴다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });

        await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
            expect.anything()
        );
    });
});
