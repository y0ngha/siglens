/**
 * FactLayer SSR integration tests for the chart [symbol]/page.tsx.
 *
 * These tests invoke the RSC directly (no render) and traverse the returned
 * element tree to assert that:
 * - Happy: bars present → TechnicalFactsSummary appears in Suspense fallback
 * - Worst: empty bars → TechnicalFactsSummary absent, page still resolves
 * - Worst: getBarsStatic throws → page resolves (null degrade, no crash)
 *
 * NOTE: TechnicalFactsSummary lives in the Suspense `fallback` prop, not in
 * `children`, so we first locate the Suspense element then inspect its fallback.
 */

vi.mock('@/widgets/symbol-page/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    FALLBACK_ANALYSIS: { summary: 'fallback' },
}));
vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekAnalysisCache: vi.fn(),
    // TechnicalFactsSummary deps (RSI thresholds)
    RSI_OVERBOUGHT_LEVEL: 70,
    RSI_OVERSOLD_LEVEL: 30,
}));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn().mockResolvedValue({
        assetInfo: {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        },
        degraded: false,
    }),
}));
// getBarsStatic is the subject under test — mocked directly so each case can
// return different bars data without going through the unstable_cache chain.
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getBarsStatic: vi.fn(),
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
        bars: (s: string, t: string, f?: string) => ['bars', s, t, f],
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
    QueryClient: class {
        setQueryData = vi.fn();
        prefetchQuery = vi.fn();
    },
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
// peekAnalysisStatic wraps peekAnalysisCache via unstable_cache(identity in tests).
// Mocking the static cache directly gives cleaner control in this test suite.
vi.mock('@/entities/analysis/lib/peekAnalysisStaticCache', () => ({
    peekAnalysisStatic: vi.fn().mockResolvedValue(null),
}));

import { Suspense, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { default as SymbolPage } from '@/app/[symbol]/page';
import { TechnicalFactsSummary } from '@/widgets/symbol-page/TechnicalFactsSummary';
import { getBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getAssetInfoResilient } from '@/entities/ticker';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockBarsStatic = vi.mocked(getBarsStatic);
const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);

const DEFAULT_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
} as never;

/**
 * Finds the `fallback` ReactNode inside the first Suspense element in `tree`.
 * TechnicalFactsSummary is placed in fallback (not children), so a standard
 * children-only traversal would miss it.
 */
function findSuspenseFallback(tree: ReactNode): ReactNode {
    const suspenseEl = findElementByType(tree, Suspense);
    if (!suspenseEl) return null;
    return (suspenseEl.props as { fallback?: ReactNode }).fallback ?? null;
}

describe('SymbolPage — FactLayer SSR integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-apply the default assetInfo mock that clearAllMocks wipes.
        mockGetAssetInfoResilient.mockResolvedValue(DEFAULT_ASSET_INFO);
    });

    it('Happy: bars 있으면 Suspense fallback에 TechnicalFactsSummary(SSR)를 렌더한다', async () => {
        mockBarsStatic.mockResolvedValue({
            bars: [
                {
                    time: 1,
                    open: 1,
                    high: 2,
                    low: 0.5,
                    close: 1.5,
                    volume: 100,
                },
            ],
            indicators: {},
        } as never);

        const tree = await SymbolPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        expect(fact).not.toBeNull();
        // Verify the component receives the expected props.
        expect((fact?.props as { symbol: string }).symbol).toBe('AAPL');
    });

    it('Worst: bars 빈 결과면 FactLayer 대신 빈 fallback(div) — 크래시 없이 페이지 정상', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        // Page must still resolve with a truthy element tree.
        expect(tree).toBeTruthy();
        // FactLayer must NOT appear when bars are empty (degrade to empty div).
        expect(fact).toBeNull();
    });

    it('Worst: getBarsStatic 실패(throw)해도 페이지가 깨지지 않는다(null degrade)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        // Page must still resolve — the .catch(→null) in page.tsx absorbs the error.
        await expect(
            SymbolPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).resolves.toBeTruthy();
    });

    it('Worst: getBarsStatic 실패 시 fallback은 빈 div (FactLayer 없음)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const tree = await SymbolPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        expect(fact).toBeNull();
    });
});
