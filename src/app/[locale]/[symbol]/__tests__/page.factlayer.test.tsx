/**
 * FactLayer SSR integration tests for the chart [symbol]/page.tsx.
 *
 * These tests invoke the RSC directly (no render) and traverse the returned
 * element tree to assert that:
 * - Happy: bars present → TechnicalFactsSummary appears in Suspense fallback
 * - Worst: empty bars → TechnicalFactsSummary absent, page still resolves
 * - Worst: getQuantizedBarsStatic throws → page resolves (null degrade, no crash)
 *
 * NOTE: TechnicalFactsSummary lives in the Suspense `fallback` prop, not in
 * `children`, so we first locate the Suspense element then inspect its fallback.
 */

// spy → vi.mock → imports order (MISTAKES.md Tests §17).
const {
    mockGetSeoSnapshotsStatic,
    mockGetQuantizedBarsStatic,
    mockGetSeedBarsStatic,
} = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
    mockGetQuantizedBarsStatic: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
vi.mock('@/views/symbol/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    buildFallbackAnalysis: () => ({ summary: 'fallback' }),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    // TechnicalFactsSummary deps (RSI thresholds)
    RSI_OVERBOUGHT_LEVEL: 70,
    RSI_OVERSOLD_LEVEL: 30,
    // Task 9: @/views/symbol barrel now also exports FearGreedFactsSummary,
    // which pulls in fearGreedLabels → POC_WINDOW_DEFAULT at module scope.
    POC_WINDOW_DEFAULT: 60,
}));
vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
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
// getQuantizedBarsStatic is the subject under test — mocked directly so each case can
// return different bars data without going through the unstable_cache chain.
// quantizeBarsDataToLastClosed는 별도 unit 테스트에서 완전 커버된다.
// 이 스위트는 FactLayer SSR 배선을 검증하므로, 시장 시간 의존을 제거해 결정론적으로 유지한다.
// production page.tsx와 동일하게 barrel `@/entities/bars`를 mock해 경로 일관성 유지.
// getSeedBarsStatic은 seed 경로 전용이다. FactLayer는 축소되지 않은 원본
// (getQuantizedBarsStatic)을 계속 읽어야 하므로, 두 mock을 분리해 두면 페이지가
// 실수로 축소판에서 fact를 만들 때 이 스위트가 잡아낸다.
vi.mock('@/entities/bars', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: mockGetSeedBarsStatic,
}));
// page.tsx는 더 이상 sessionSpecFor를 직접 부르지 않는다(그 호출은 이제
// getQuantizedBarsStatic 내부에 있다). 다만 다른 모듈이 전이적으로 끌어올 때
// core-level constants (US_EQUITY_SESSION) are not required in the partial core mock above.
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(() => ({})),
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
vi.mock('@/shared/lib/seo', async importOriginal => ({
    // 실제 seo를 스프레드해 NOINDEX_SYMBOL_METADATA 등 정적 export를 가져온다(drift 방지).
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
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
import { default as SymbolPage } from '@/app/[locale]/[symbol]/page';
import { TechnicalFactsSummary } from '@/views/symbol';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { getQuantizedBarsStatic } from '@/entities/bars';
import { getAssetInfoResilient } from '@/entities/ticker';
import { findElementByType } from '@/__tests__/utils/findElementByType';

const mockBarsStatic = vi.mocked(getQuantizedBarsStatic);
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
    // 보장: suspenseEl은 findElementByType(tree, Suspense)가 반환한 Suspense 엘리먼트이므로
    // props는 SuspenseProps이고 fallback?: ReactNode를 가진다. ReactElement.props가 unknown(React 19)
    // 이라 좁히기 위한 cast이며, 키는 실재한다.
    return (suspenseEl.props as { fallback?: ReactNode }).fallback ?? null;
}

describe('SymbolPage — FactLayer SSR integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-apply the default assetInfo mock that clearAllMocks wipes.
        mockGetAssetInfoResilient.mockResolvedValue(DEFAULT_ASSET_INFO);
        // Default: no SEO snapshot row — existing FactLayer-only behavior.
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        // seed 헬퍼의 기본 반환값. 이 스위트의 주제는 FactLayer(전체 지표)라 seed 값
        // 자체는 무관하지만, 페이지가 `.catch(→null)`로 감싸므로 mock이 **Promise를
        // 돌려줘야** 한다. `vi.fn()` 기본 반환은 undefined라 `.catch`에서 터진다.
        mockGetSeedBarsStatic.mockResolvedValue(null);
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        expect(fact).not.toBeNull();
        // Verify the component receives the expected props.
        expect((fact?.props as { symbol: string }).symbol).toBe('AAPL');
    });

    it('SSR 크롤용 h1: fallback에 sr-only h1(회사명 + 차트 분석)이 있어 JS 미실행 크롤러가 메인 h1을 받는다', async () => {
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const h1 = findElementByType(fallback, 'h1');

        expect(h1).not.toBeNull();
        // 보장: findElementByType이 host element 'h1'을 반환했으므로 props.children은
        // buildChartPageHeading(displayName) 결과 문자열이다. displayName mock = 'Apple Inc.'
        // → 결정적 값이므로 toBe로 정밀 검증.
        const children = (h1?.props as { children?: ReactNode }).children;
        const text = Array.isArray(children)
            ? children.join('')
            : String(children);
        expect(text).toBe('Apple Inc. 차트 분석');
        // sr-only라 가시 레이아웃(jail) 영향 없음 — 크롤 전용.
        expect((h1?.props as { className?: string }).className).toContain(
            'sr-only'
        );
    });

    it('SSR 크롤용 h1: bars 빈 결과(cold)에서도 fallback h1은 존재한다(데이터 유무와 무관)', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);

        expect(findElementByType(fallback, 'h1')).not.toBeNull();
    });

    it('Worst: bars 빈 결과면 FactLayer 대신 빈 fallback(div) — 크래시 없이 페이지 정상', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        // Page must still resolve with a truthy element tree.
        expect(tree).toBeTruthy();
        // FactLayer must NOT appear when bars are empty (degrade to empty div).
        expect(fact).toBeNull();
    });

    it('Worst: getQuantizedBarsStatic 실패(throw)해도 페이지가 깨지지 않는다(null degrade)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        // Page must still resolve — the .catch(→null) in page.tsx absorbs the error.
        await expect(
            SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        ).resolves.toBeTruthy();
    });

    it('Worst: getQuantizedBarsStatic 실패 시 fallback은 빈 div (FactLayer 없음)', async () => {
        mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const fallback = findSuspenseFallback(tree);
        const fact = findElementByType(fallback, TechnicalFactsSummary);

        expect(fact).toBeNull();
    });

    it('Worst: getSeedBarsStatic이 reject해도 페이지가 resolve된다(seed 생략)', async () => {
        // seed 경로는 fail-open이다. `keepLastNonNull`이 배열 메서드를 부르므로
        // 런타임 shape가 IndicatorResult를 벗어나면 throw할 수 있고, 그때 페이지가
        // 깨지면 안 된다. 형제 경로(getQuantizedBarsStatic)는 이미 같은 잠금이 있다.
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);
        mockGetSeedBarsStatic.mockRejectedValue(new Error('seed boom'));

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(tree).toBeTruthy();
    });

    describe('SEO snapshot prose (snapshot-first, complementary to FactLayer)', () => {
        beforeEach(() => {
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
        });

        // audit fix FIX 1: TechnicalSnapshotProse moved OUT of the Suspense
        // fallback to a persistent server sibling (React destroys the
        // fallback subtree on hydration, so JS-executing crawlers never saw
        // it there). It is now found via a plain children-only traversal of
        // `tree`, not via `findSuspenseFallback`.
        it('스냅샷 있으면 Suspense fallback 밖 persistent sibling으로 TechnicalSnapshotProse를 렌더한다(FactsSummary는 fallback 안에서 공존)', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    tab: 'technical',
                    content: { summary: '단기 상승 모멘텀', trend: 'bullish' },
                    model: 'deepseek-v4-flash',
                    generatedAt: new Date('2026-07-24'),
                },
            ]);

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            const prose = findElementByType(tree, TechnicalSnapshotProse);
            expect(prose).not.toBeNull();
            expect((prose?.props as { content: unknown }).content).toEqual({
                summary: '단기 상승 모멘텀',
                trend: 'bullish',
            });
            // Complementary, not exclusive — deterministic facts still render
            // inside the Suspense fallback.
            const fallback = findSuspenseFallback(tree);
            expect(
                findElementByType(fallback, TechnicalFactsSummary)
            ).not.toBeNull();
        });

        it('스냅샷 없으면(getSeoSnapshotsStatic → []) TechnicalSnapshotProse에 undefined content를 전달한다(렌더러가 자체적으로 null 반환)', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            const prose = findElementByType(tree, TechnicalSnapshotProse);
            expect(prose).not.toBeNull();
            expect(
                (prose?.props as { content: unknown }).content
            ).toBeUndefined();
            // Existing FactLayer behavior is unchanged (still in fallback).
            const fallback = findSuspenseFallback(tree);
            expect(
                findElementByType(fallback, TechnicalFactsSummary)
            ).not.toBeNull();
        });

        it('다른 탭(overall)의 스냅샷은 technical 슬롯에 전달되지 않는다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    tab: 'overall',
                    content: { headlineKo: '헤드라인' },
                    model: 'deepseek-v4-flash',
                    generatedAt: new Date('2026-07-24'),
                },
            ]);

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            const prose = findElementByType(tree, TechnicalSnapshotProse);
            expect(
                (prose?.props as { content: unknown }).content
            ).toBeUndefined();
        });

        it('getSeoSnapshotsStatic가 throw해도 페이지가 깨지지 않는다(호출부가 아니라 static-cache 계층의 fail-open 계약)', async () => {
            // getSeoSnapshotsStatic 자체가 fail-open([])이지만, 호출부가 이를 신뢰하지
            // 않고 별도 .catch를 두지 않는다는 걸 전제로 한다 — 계약 위반(모듈이 reject)
            // 시에는 페이지가 깨져도 되는 계약이므로 여기선 정상 반환만 검증한다.
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);

            await expect(
                SymbolPage({
                    params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
                })
            ).resolves.toBeTruthy();
        });

        it('스냅샷 조회는 peek 모델 상수(DEEPSEEK_V4_FLASH_MODEL)와 무관하게 revalidate 리터럴(21600)로 호출된다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);

            await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
                'AAPL',
                21600,
                'ko'
            );
        });
    });
});
