/**
 * FactLayer SSR integration tests for the overall [symbol]/overall/page.tsx.
 *
 * These tests invoke the RSC directly (no render) and traverse the returned
 * element tree to assert that:
 * - Happy: cached overall analysis present → OverallFactsSummary in Suspense fallback
 * - Worst: peek MISS (null) → OverallFactsSummary absent, page still resolves
 *
 * OverallFactsSummary lives in the Suspense `fallback` prop, not in `children`,
 * so we locate the Suspense element then inspect its fallback.
 */

vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
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
vi.mock('@/shared/lib/seo', () => ({
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 종합 분석',
        fullTitle: 'AAPL 종합 분석 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL/overall',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekOverallAnalysisCache: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
// staticSymbolCache is the subject under test — mocked so each case can control
// what the page receives as cachedOverall without going through the unstable_cache chain.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(),
}));

import { Suspense, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { default as OverallPage } from '@/app/[symbol]/overall/page';
import { OverallFactsSummary } from '@/widgets/overall';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockStatic = vi.mocked(staticSymbolCache);

/**
 * Finds the `fallback` ReactNode inside the first Suspense element in `tree`.
 * OverallFactsSummary is placed in fallback (not children), so a standard
 * children-only traversal would miss it.
 */
function findSuspenseFallback(tree: ReactNode): ReactNode {
    const suspenseEl = findElementByType(tree, Suspense);
    if (!suspenseEl) return null;
    return (suspenseEl.props as { fallback?: ReactNode }).fallback ?? null;
}

describe('OverallPage — FactLayer SSR integration', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Happy: cached 종합 분석 있으면 Suspense fallback에 OverallFactsSummary(SSR)를 렌더한다', async () => {
        const cached = {
            headlineKo: '강세 우위',
            integratedConclusionKo: '4축 종합 결론 텍스트',
            scenarios: [
                {
                    name: 'bullish' as const,
                    triggerConditionKo: '조건',
                    priceRangeKo: '$180~$200',
                },
            ],
            technicalBulletsKo: [],
            fundamentalBulletsKo: [],
            newsBulletsKo: [],
            optionsBulletsKo: [],
            riskFactorsKo: [],
        };
        mockStatic.mockResolvedValue(cached as never);

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const factLayer = findElementByType(fallback, OverallFactsSummary);

        expect(factLayer).not.toBeNull();
        expect((factLayer?.props as { symbol: string }).symbol).toBe('AAPL');
    });

    it('Worst: peek MISS(null)면 OverallFactsSummary 미렌더 — 크래시 없이 페이지 정상', async () => {
        mockStatic.mockResolvedValue(null as never);

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(tree).toBeTruthy();

        const fallback = findSuspenseFallback(tree);
        const factLayer = findElementByType(fallback, OverallFactsSummary);
        expect(factLayer).toBeNull();
    });

    it('Worst: staticSymbolCache 실패(throw)해도 페이지가 깨지지 않는다(null degrade)', async () => {
        mockStatic.mockRejectedValue(new Error('redis infra down'));

        await expect(
            OverallPage({ params: Promise.resolve({ symbol: 'aapl' }) })
        ).resolves.toBeTruthy();
    });

    it('Worst: staticSymbolCache 실패 시 fallback은 스켈레톤 div(FactLayer 없음)', async () => {
        mockStatic.mockRejectedValue(new Error('redis infra down'));

        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const factLayer = findElementByType(fallback, OverallFactsSummary);
        expect(factLayer).toBeNull();
    });
});
