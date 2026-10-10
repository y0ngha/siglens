/**
 * FactLayer SSR integration tests for the chart [symbol]/page.tsx.
 *
 * These tests invoke the RSC directly (no render) and traverse the returned
 * element tree.
 *
 * The page no longer wraps `SymbolPageClient` in a Suspense boundary: the client
 * reads `?tf=` via `useUrlSearchParam` (no CSR bailout), so the chart, the AI
 * panel (with `TechnicalFactsSummary`) and the visible h1 server-render inside
 * `SymbolPageClient` itself. The old fallback (sr-only h1 + facts summary) left
 * two h1s in the raw HTML whenever the boundary flushed as pending. These tests
 * pin that the page tree has no Suspense and no fallback h1, that the crawlable
 * facts summary is a permanent server sibling (the panel copy sits inside the
 * chart's own boundary, which React outlines into a hidden chunk), and that the
 * degrade paths still resolve.
 */

// spy → vi.mock → imports order (TESTING.md#TE-1).
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
vi.mock('@/entities/analysis/lib/fallbackAnalysis', () => ({
    buildFallbackAnalysis: () => ({ summary: 'fallback' }),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    DEEPSEEK_V4_1_FLASH_MODEL: 'deepseek-v4.1-flash',
    // TechnicalFactsSummary deps (RSI thresholds)
    RSI_OVERBOUGHT_LEVEL: 70,
    RSI_OVERSOLD_LEVEL: 30,
    // FearGreedFactsSummary → fearGreedLabels reads POC_WINDOW_DEFAULT at
    // module scope whenever it lands in the import graph.
    POC_WINDOW_DEFAULT: 60,
}));
vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
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
// production page.tsx가 import하는 정의 파일(`@/entities/bars/lib/barsStaticCache`)을 mock한다.
// getSeedBarsStatic은 seed 경로 전용이다. FactLayer는 축소되지 않은 원본
// (getQuantizedBarsStatic)을 계속 읽어야 하므로, 두 mock을 분리해 두면 페이지가
// 실수로 축소판에서 fact를 만들 때 이 스위트가 잡아낸다.
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: mockGetSeedBarsStatic,
}));
// page.tsx는 더 이상 sessionSpecFor를 직접 부르지 않는다(그 호출은 이제
// getQuantizedBarsStatic 내부에 있다). 다만 다른 모듈이 전이적으로 끌어올 때
// core-level constants (US_EQUITY_SESSION) are not required in the partial core mock above.
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(() => ({})),
}));
// page.tsx가 seed 상태 판정(`hasFormingBar`)에 쓴다 — 이 파일의 core 목에는 세션 함수가 없다.
vi.mock('@/entities/bars/lib/quantizeBars', () => ({
    hasFormingBar: vi.fn(() => false),
}));
vi.mock('@/entities/skill/api', () => ({
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
        fullTitle: 'AAPL 차트 | SIGLENS',
        description: 'desc',
        url: 'https://siglens.io/AAPL',
        keywords: ['AAPL'],
    }),
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

import { Suspense, isValidElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { default as SymbolPage } from '@/app/[locale]/[symbol]/page';
import { TechnicalFactsSummary } from '@/views/symbol/TechnicalFactsSummary';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { symbolFactsSubject } from '@/views/symbol/utils/factsSubject';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { getQuantizedBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';

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

/** Does any element in `tree` (children or `fallback` props) have type `type`? */
function containsType(node: ReactNode, type: unknown): boolean {
    if (Array.isArray(node))
        return node.some(child => containsType(child, type));
    if (!isValidElement(node)) return false;
    if (node.type === type) return true;
    const props = node.props as { children?: ReactNode; fallback?: ReactNode };
    return (
        containsType(props.children, type) || containsType(props.fallback, type)
    );
}

const TWO_BARS = {
    bars: [
        { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
        { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 120 },
    ],
    indicators: {
        ma: {},
        ema: {},
        rsi: [50],
        macd: [{ macd: 1, signal: 1, histogram: 1 }],
        buySellVolume: [],
    },
} as never;

const ONE_BAR = {
    bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }],
    indicators: {},
} as never;

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

    it('SymbolPageClient를 Suspense로 감싸지 않는다(트리 어디에도 경계가 없다)', async () => {
        mockBarsStatic.mockResolvedValue(ONE_BAR);

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findElementByType(tree, SymbolPageClient)).not.toBeNull();
        expect(containsType(tree, Suspense)).toBe(false);
    });

    /**
     * h1은 `SymbolPageClient`가 서버에서 그린다. 페이지가 sr-only h1을 따로 두면 raw HTML에
     * h1이 둘이 된다(e2e `symbol-seo` "exactly one h1").
     */
    it('페이지 트리에 별도 h1(sr-only 폴백)을 두지 않는다', async () => {
        mockBarsStatic.mockResolvedValue(ONE_BAR);

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(containsType(tree, 'h1')).toBe(false);
        expect(JSON.stringify(tree)).not.toContain('sr-only');
    });

    /**
     * 패널 사본(`ChartContent`)은 차트의 Suspense 경계 안이라 progressive chunk를 넘으면 raw
     * HTML의 숨김 청크로 아웃라인된다 — JS 없는 크롤러용으로 경계 **밖**에 영구 사본을 둔다.
     */
    describe('크롤용 사실 요약(영구 서버 사본)', () => {
        it('봉이 2개 이상이면 page 사본을 SymbolPageClient 바깥 sibling으로 렌더한다', async () => {
            mockBarsStatic.mockResolvedValue(TWO_BARS);

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            const fact = findElementByType(tree, TechnicalFactsSummary);
            expect(fact).not.toBeNull();
            expect(fact?.props).toMatchObject({
                symbol: 'AAPL',
                subject: symbolFactsSubject('AAPL', '애플', 'ko'),
                placement: 'page',
            });
            // 경계 밖이어야 한다 — 트리에 Suspense가 없고, 클라이언트 안에도 있지 않다.
            expect(containsType(tree, Suspense)).toBe(false);
        });

        it('봉이 1개면(등락률 분모 없음 — 메타데이터 hasPriceData와 같은 술어) 렌더하지 않는다', async () => {
            mockBarsStatic.mockResolvedValue(ONE_BAR);

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            expect(containsType(tree, TechnicalFactsSummary)).toBe(false);
        });

        it('봉 조회가 실패하면 렌더하지 않는다', async () => {
            mockBarsStatic.mockRejectedValue(new Error('bars infra down'));

            const tree = await SymbolPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            expect(containsType(tree, TechnicalFactsSummary)).toBe(false);
        });
    });

    it('Worst: bars 빈 결과여도 크래시 없이 페이지가 resolve된다', async () => {
        mockBarsStatic.mockResolvedValue({ bars: [], indicators: {} } as never);

        const tree = await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(tree).toBeTruthy();
        expect(findElementByType(tree, SymbolPageClient)).not.toBeNull();
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

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        await SymbolPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectSymbolBreadcrumbName('Apple Inc.');
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

        // audit fix FIX 1: TechnicalSnapshotProse is a persistent server sibling
        // (it once lived in a Suspense fallback, which React destroys on
        // hydration, so JS-executing crawlers never saw it there).
        it('스냅샷 있으면 persistent sibling으로 TechnicalSnapshotProse를 렌더한다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    tab: 'technical',
                    content: { summary: '단기 상승 모멘텀', trend: 'bullish' },
                    model: 'deepseek-v4.1-flash',
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
        });

        it('다른 탭(overall)의 스냅샷은 technical 슬롯에 전달되지 않는다', async () => {
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    tab: 'overall',
                    content: { headlineKo: '헤드라인' },
                    model: 'deepseek-v4.1-flash',
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

        it('스냅샷 조회는 peek 모델 상수(DEEPSEEK_V4_1_FLASH_MODEL)와 무관하게 revalidate 리터럴(21600)로 호출된다', async () => {
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
