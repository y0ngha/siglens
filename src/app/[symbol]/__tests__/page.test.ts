// spy → vi.mock → imports order (MISTAKES.md Tests §17).
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
vi.mock('@/views/symbol/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    FALLBACK_ANALYSIS: { summary: 'fallback' },
}));
vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    peekAnalysisCache: vi.fn(),
    // Task 9: @/views/symbol barrel now also exports FearGreedFactsSummary,
    // which pulls in fearGreedLabels → POC_WINDOW_DEFAULT at module scope.
    POC_WINDOW_DEFAULT: 60,
    // getSeedBarsStatic(barsStaticCache)이 지표 화이트리스트의 baseline으로 쓴다.
    EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} },
    // quantizeBarsDataToLastClosed가 봉이 **있을 때만** 호출한다. 빈 배열은
    // `bars.length === 0`에서 단락되므로 이 목이 없던 동안에도 드러나지 않았지만,
    // 봉이 하나라도 있는 경로(콘텐츠 게이트 hasPriceData:true 검증)에서는 즉시
    // `is not a function`으로 터진다. 장 마감으로 고정해 quantize가 입력을 그대로
    // 통과시키게 한다 — 이 파일의 관심사는 세션 판정이 아니다.
    isRegularSessionOpen: vi.fn(() => false),
}));
vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: vi.fn(() => ({
        indexable: true,
        reason: 'popular',
    })),
}));
// `indicators`는 BarsData의 필수 필드다 — 비워 두면 seed 축소(getSeedBarsStatic)가
// undefined를 읽는다. 실제 shape에 맞춰 빈 지표를 함께 준다.
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi
        .fn()
        .mockResolvedValue({ bars: [], indicators: { ma: {}, ema: {} } }),
}));
// page.tsx calls sessionSpecFor(marketProfile) before quantize — stub it out so the
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
        bars: (s: string, t: string) => ['bars', s, t],
    },
    QUERY_STALE_TIME_MS: 5000,
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    // 실제 seo 모듈을 스프레드해 NOINDEX_SYMBOL_METADATA 같은 정적 export를 그대로
    // 가져온다(상수 인라인 복제 → drift 방지). 빌더만 아래에서 결정적으로 오버라이드한다.
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 차트',
        fullTitle: 'AAPL 차트 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL',
        keywords: ['AAPL'],
    }),
    // page.tsx delegates SEO content selection to resolveSymbolSeoContent, so
    // the mock must cover it directly (the real helper calls buildSymbolSeoContent
    // at module-scope, bypassing the mock above when spread via importOriginal).
    resolveSymbolSeoContent: vi.fn().mockReturnValue({
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
    // 클래스로 모킹한다: page.tsx가 `new QueryClient(...)`로 생성하므로
    // 화살표 함수 구현(vi.fn().mockImplementation(() => ...))은 생성자로 쓸 수 없다.
    QueryClient: class {
        setQueryData = vi.fn();
        prefetchQuery = vi.fn();
    },
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import {
    generateMetadata,
    default as SymbolPage,
    revalidate,
} from '@/app/[symbol]/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    DEEPSEEK_V4_FLASH_MODEL,
    peekAnalysisCache,
} from '@y0ngha/siglens-core';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { RelatedSymbols } from '@/views/symbol';
import { getBarsAction } from '@/entities/bars/actions';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { notFound } from 'next/navigation';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockPeekAnalysisCache = peekAnalysisCache as MockedFunction<
    typeof peekAnalysisCache
>;
const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;
// 콘텐츠 게이트(hasPriceData) 배선 검증용 — page.tsx는 getQuantizedBarsStatic을
// 거치지만 그 안쪽이 결국 이 액션을 부른다.
const mockGetBarsAction = getBarsAction as MockedFunction<typeof getBarsAction>;

interface ClientSeedProps {
    initialAnalysis: unknown;
    initialAnalysisFailed: unknown;
    initialLockedInfoDepth: unknown;
}

describe('Symbol page', () => {
    describe('ISR route config', () => {
        it('exports revalidate = 21600 (literal — required for Next.js static analysis)', () => {
            // MISTAKES §15: route segment config must be a literal, not an imported constant
            expect(revalidate).toBe(21600);
        });
    });

    describe('generateMetadata', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            // getBlockedSymbolMetadata reads snapshots only on the degraded path
            // (symbolIndexabilityMetadata.ts) — default to no-snapshot so degraded
            // cases here don't spuriously flip to indexable via hasSnapshot.
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);
            mockEvaluateSymbolIndexability.mockImplementation(
                ({ assetInfo, degraded }) => {
                    if (degraded) {
                        return { indexable: false, reason: 'degraded' };
                    }
                    if (assetInfo === null) {
                        return { indexable: false, reason: 'asset-missing' };
                    }
                    return { indexable: true, reason: 'popular' };
                }
            );
        });

        it('returns noindex for invalid ticker', async () => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '!!!invalid' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: true });
        });

        it('returns metadata with title for valid ticker', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            // symbolMetadataFromSeo가 title을 { absolute }로 감싸 루트 레이아웃의
            // title.template("%s | Siglens" 자동 접미사)을 무시한다(Task 6).
            expect(metadata.title).toEqual({ absolute: 'AAPL 차트' });
        });

        it('uses the snapshot-derived description when a technical snapshot exists (spec 2026-07-24 Task 8)', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);
            mockGetSeoSnapshotsStatic.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    tab: 'technical',
                    content: {
                        summary: 'AAPL은 200일선 위에서 상승 추세입니다.',
                    },
                    model: 'deepseek-v4-flash',
                    generatedAt: new Date(),
                    updatedAt: new Date(),
                },
            ]);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            // FIX 5 (audit): description is prefixed with the resolved
            // display name (subject; buildDisplayName is mocked to
            // 'Apple Inc.' in this suite) before clamping.
            expect(metadata.description).toBe(
                'Apple Inc. — AAPL은 200일선 위에서 상승 추세입니다.'
            );
            // og/twitter keep the templated copy — only the search-facing
            // <meta name="description"> is overridden (spec 2026-07-24 Task 8).
            const og = metadata.openGraph as Record<string, unknown>;
            expect(og.description).toBe('desc');
        });

        it('falls back to the templated description when no technical snapshot exists', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.description).toBe('desc');
        });

        it('canonical excludes tf — ISR page uses clean canonical regardless of query params', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            // ISR 페이지: searchParams 없이 렌더되므로 canonical은 clean URL
            expect(metadata.robots).toBeUndefined();
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL'
            );
        });

        it('does not add noindex when no tf param', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.robots).toBeUndefined();
        });

        it('returns noindex when getAssetInfoResilient degrades on infra failure', async () => {
            // 인프라 실패 시 fallback의 종목 실재 여부가 불명하므로 검색 노출을 막는다.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'AAPL', name: 'AAPL' },
                degraded: true,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: true });
        });

        it('gate blocked unapproved longtail returns noindex', async () => {
            const assetInfo = {
                symbol: '0NEUSD',
                name: 'Stone USD',
            };
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo,
                degraded: false,
            } as never);
            mockEvaluateSymbolIndexability.mockReturnValueOnce({
                indexable: false,
                reason: 'longtail-default-blocked',
            });

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '0NEUSD' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
                symbol: '0NEUSD',
                assetInfo,
                degraded: false,
                hasSnapshot: undefined,
                // 이 파일의 bars 모킹은 `bars: []`를 돌려주므로 콘텐츠 게이트가
                // false를 본다(2026-08-24 추가 — 봉 없는 죽은 티커 차단).
                hasPriceData: false,
            });
        });

        /**
         * 콘텐츠 게이트 배선 — 봉 유무가 실제로 평가기까지 전달돼야 한다.
         * 게이트 자체의 판정 로직은 `evaluateSymbolIndexability.test.ts`가 다룬다.
         */
        it('봉이 있으면 hasPriceData: true를 게이트에 넘긴다', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'HASBARS', name: 'Has Bars' },
                degraded: false,
            } as never);
            // 2봉 — `buildTechnicalFacts`가 등락률을 내려면 직전 봉이 필요하다.
            mockGetBarsAction.mockResolvedValueOnce({
                bars: [
                    { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 },
                    { time: 2, open: 1, high: 2, low: 1, close: 2, volume: 1 },
                ],
                indicators: { ma: {}, ema: {}, rsi: [], macd: [] },
            } as never);

            await generateMetadata({
                params: Promise.resolve({ symbol: 'hasbars' }),
            });

            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
                expect.objectContaining({ hasPriceData: true })
            );
        });

        /**
         * 게이트 술어는 본문과 **같아야** 한다. `bars.length > 0`으로 두었을 때
         * CTK(상장폐지, 봉 1개)가 프로덕션에서 새어 나갔다 — `buildTechnicalFacts`는
         * 등락률 분모로 직전 봉이 필요해 2개 미만이면 null을 반환하고, 그러면 본문의
         * 지표 요약 블록이 통째로 렌더되지 않아 페이지가 껍데기가 된다.
         */
        it('봉이 1개뿐이면 hasPriceData: false — 본문 지표 블록이 렌더되지 않는 조건과 일치', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'ONEBAR', name: 'One Bar' },
                degraded: false,
            } as never);
            mockGetBarsAction.mockResolvedValueOnce({
                bars: [
                    { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 },
                ],
                indicators: { ma: {}, ema: {} },
            } as never);

            await generateMetadata({
                params: Promise.resolve({ symbol: 'onebar' }),
            });

            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
                expect.objectContaining({ hasPriceData: false })
            );
        });

        /**
         * 인프라 장애(=조회 throw)를 `false`로 매핑하면 FMP 장애 한 번이 전 종목
         * 색인 해제로 번진다. 실패는 `undefined`(판단 보류)여야 한다.
         */
        it('봉 조회가 실패하면 hasPriceData를 undefined로 남긴다 (장애 ≠ 콘텐츠 없음)', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'NOBARS', name: 'No Bars' },
                degraded: false,
            } as never);
            mockGetBarsAction.mockRejectedValueOnce(new Error('FMP down'));

            await generateMetadata({
                params: Promise.resolve({ symbol: 'nobars' }),
            });

            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith(
                expect.objectContaining({ hasPriceData: undefined })
            );
        });

        it('gate allowed curated crypto keeps metadata indexable', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'BTCUSD',
                    name: 'Bitcoin USD',
                    fmpSymbol: 'BTCUSD',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });

            expect(metadata.robots).toBeUndefined();
        });
    });

    describe('SymbolPage (narrative seed)', () => {
        beforeEach(() => {
            // vi.clearAllMocks()를 쓰지 않는 이유: QueryClient 등 mockImplementation
            // 으로 구성한 모듈 모킹의 구현까지 지워져 생성자 모킹이 깨진다. 이 블록이
            // 의존하는 두 mock만 선택적으로 초기화한다.
            mockGetAssetInfoResilient.mockReset();
            mockPeekAnalysisCache.mockReset();
            mockGetSeoSnapshotsStatic.mockReset();
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);
            // Default: no SEO snapshot row — this describe covers peek/initialAnalysis
            // seeding, which is orthogonal to the snapshot section.
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        });

        async function getClientProps(): Promise<ClientSeedProps> {
            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const client = findElementByType(tree, SymbolPageClient);
            if (client === null) {
                throw new Error('SymbolPageClient not found in tree');
            }
            return client.props as ClientSeedProps;
        }

        it('peek HIT 시 캐시된 분석을 initialAnalysis로 전달한다', async () => {
            const cached = { result: { summary: 'cached analysis' } };
            mockPeekAnalysisCache.mockResolvedValue(cached as never);

            const props = await getClientProps();

            expect(mockPeekAnalysisCache).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'AAPL',
                DEEPSEEK_V4_FLASH_MODEL,
                false,
                'free',
                undefined,
                undefined
            );
            expect(props.initialAnalysis).toMatchObject(cached.result);
        });

        it('peek MISS(null) 시 FALLBACK_ANALYSIS를 전달한다', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const props = await getClientProps();

            expect(props.initialAnalysis).toMatchObject({
                summary: 'fallback',
            });
        });

        it('peek가 throw해도 크래시 없이 FALLBACK_ANALYSIS로 degrade한다', async () => {
            mockPeekAnalysisCache.mockRejectedValue(new Error('redis down'));

            const props = await getClientProps();

            expect(props.initialAnalysis).toMatchObject({
                summary: 'fallback',
            });
        });

        it('peek 모델 상수(DEEPSEEK_V4_FLASH_MODEL)가 SEO pre-warm 스냅샷 저장 모델과 동일 참조다 (spec §7 5축 캐시 키 정합)', async () => {
            // harvest.ts는 이 상수를 PREWARM_MODEL_ID = DEEPSEEK_V4_FLASH_MODEL로 스냅샷
            // content.model에 저장한다. peek이 다른 모델 상수로 조회하면 스냅샷이 가리키는
            // 캐시 엔트리와 어긋나 5축 정합이 깨진다 — 여기선 페이지가 peek을 호출할 때 쓰는
            // modelId 인자가 core에서 import한 그 상수(mock 모듈에서도 동일 참조)임을 고정한다.
            mockPeekAnalysisCache.mockResolvedValue(null);

            await getClientProps();

            expect(mockPeekAnalysisCache).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'AAPL',
                DEEPSEEK_V4_FLASH_MODEL,
                false,
                'free',
                undefined,
                undefined
            );
        });

        it('seed 여부와 무관하게 initialAnalysisFailed=true를 유지한다 (순수 additive)', async () => {
            mockPeekAnalysisCache.mockResolvedValue({
                result: { summary: 'cached analysis' },
            } as never);

            const props = await getClientProps();

            expect(props.initialAnalysisFailed).toBe(true);
        });

        it('peek MISS 시에도 initialAnalysisFailed=true를 유지한다', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const props = await getClientProps();

            expect(props.initialAnalysisFailed).toBe(true);
        });

        it('peek HIT의 lockedInfoDepth를 initialLockedInfoDepth로 그대로 전달한다', async () => {
            mockPeekAnalysisCache.mockResolvedValue({
                result: { summary: 'cached analysis' },
                lockedInfoDepth: ['partial_detail', 'full_detail'],
            } as never);

            const props = await getClientProps();

            expect(props.initialLockedInfoDepth).toEqual([
                'partial_detail',
                'full_detail',
            ]);
        });

        it('peek MISS(null) 시 initialLockedInfoDepth는 빈 배열로 기본값 처리된다', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const props = await getClientProps();

            expect(props.initialLockedInfoDepth).toEqual([]);
        });

        it('does not render chart FAQ JSON-LD', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const serialized = JSON.stringify(tree);

            expect(serialized).not.toContain('FAQPage');
        });

        // audit fix FIX 1: TechnicalSnapshotProse must be a PERSISTENT server
        // sibling OUTSIDE the Suspense fallback — React destroys the fallback
        // subtree on hydration, so JS-executing crawlers (Googlebot renderer
        // included) never see prose that only lives inside `fallback`.
        // findElementByType only follows `.props.children` (never
        // `.props.fallback`), so it is a reliable proxy for "is this element a
        // plain sibling, not buried in the fallback prop" — it would have
        // returned null against the pre-fix tree (prose nested in
        // `<Suspense fallback={...}>`).
        it('mounts TechnicalSnapshotProse as a sibling OUTSIDE the Suspense fallback (FIX 1)', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(
                findElementByType(tree, TechnicalSnapshotProse)
            ).not.toBeNull();
        });

        // UI audit FIX 1: TechnicalSnapshotProse used to be the FIRST child of
        // <main>, sharing the fixed-height jail's flex budget with the chart —
        // it visually squeezed/clipped the chart and rendered before the
        // (fallback) h1 in DOM order (heading-order inversion, WCAG 1.3.1). The
        // fix moves it to the LAST child of <main>, after the chart wrapper,
        // and makes <main> itself the scroll container (overflow-y-auto) so
        // the chart wrapper (h-full + shrink-0) never competes for height.
        it('mounts TechnicalSnapshotProse after the chart wrapper, never as the first flex child (FIX 1)', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            const main = findElementByType(tree, 'main');
            if (main === null) throw new Error('<main> not found in tree');

            const mainChildren = (main.props as { children: unknown }).children;
            if (!Array.isArray(mainChildren)) {
                throw new Error('<main> children is not an array');
            }

            // 프로즈는 차트 wrapper **뒤**에 와야 한다 — 그래야 (a) 차트와 높이를
            // 두고 경쟁하는 첫 flex child가 아니게 되고, (b) fallback/클라 h1이
            // 앞선 차트 wrapper 안에 있으므로 DOM 순서상 h1보다 뒤에 온다.
            //
            // "마지막 child"로 단언하지 않는다. 2026-08-24에 RelatedSymbols(심볼 간
            // 내부링크)가 프로즈 뒤에 추가되면서 마지막 자리가 바뀌었는데, FIX 1이
            // 지키려던 것은 "마지막"이 아니라 "차트 wrapper보다 뒤"다. 위치를 절대
            // 인덱스로 고정하면 그 뒤에 뭘 붙일 때마다 의미 없이 깨진다.
            const proseIndex = mainChildren.findIndex(
                child =>
                    (child as { type?: unknown } | null)?.type ===
                    TechnicalSnapshotProse
            );
            expect(proseIndex).toBeGreaterThan(-1);
            // 차트 wrapper = h-full shrink-0 div (Suspense 경계를 품는 자식).
            const chartWrapperIndex = mainChildren.findIndex(child => {
                const className = (
                    child as { props?: { className?: unknown } } | null
                )?.props?.className;
                return (
                    typeof className === 'string' &&
                    className.includes('h-full') &&
                    className.includes('shrink-0')
                );
            });
            expect(chartWrapperIndex).toBeGreaterThan(-1);
            expect(proseIndex).toBeGreaterThan(chartWrapperIndex);
        });

        /**
         * 칩은 이제 **레이아웃**이 jail 밖에서 렌더한다(`[symbol]/layout.tsx`).
         * 이 `<main>`은 차트 라우트에서 자체 `overflow-y-auto` 스크롤 컨테이너라,
         * 여기 두면 칩이 중첩 스크롤러 안쪽에 깔려 사용자가 페이지를 내려 푸터를
         * 봐도 도달하지 못한다 — DOM에는 있어 크롤러는 보지만 사람은 못 보는
         * 상태가 된다(2026-08-25 사용자 제보로 발견).
         *
         * 되돌아오는 회귀를 막는다. 위치 계약은 layout.test.tsx가 고정한다.
         */
        it('RelatedSymbols를 <main> 안에 두지 않는다 (중첩 스크롤러에 묻힘)', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            const main = findElementByType(tree, 'main');
            if (main === null) throw new Error('<main> not found in tree');
            const mainChildren = (main.props as { children: unknown }).children;
            if (!Array.isArray(mainChildren)) {
                throw new Error('<main> children is not an array');
            }
            expect(
                mainChildren.some(
                    child =>
                        (child as { type?: unknown } | null)?.type ===
                        RelatedSymbols
                )
            ).toBe(false);
        });

        // UI audit FIX 1: <main> must be the scroll container so content
        // below the chart wrapper is reachable (not permanently clipped by
        // the sticky-footer jail's overflow-hidden, which the definite-height
        // regression guard in SymbolLayoutClient.test.tsx forbids changing).
        it('gives <main> overflow-y-auto so below-chart content is reachable, not clipped (FIX 1)', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            const main = findElementByType(tree, 'main');
            if (main === null) throw new Error('<main> not found in tree');

            const className = (main.props as { className: string }).className;
            expect(className).toContain('overflow-y-auto');
        });

        it('does not render hidden keyword stuffing copy', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const serialized = JSON.stringify(tree);

            expect(serialized).not.toContain('도지나 해머');
            expect(serialized).not.toContain('볼린저밴드');
            expect(serialized).not.toContain('보조지표 13종');
        });
    });

    describe('SymbolPage — notFound gate (degraded path)', () => {
        const mockNotFound = notFound as MockedFunction<typeof notFound>;

        beforeEach(() => {
            // Reset all mocks so prior test state (e.g. peekAnalysisCache calls
            // from the narrative-seed suite) does not pollute these assertions.
            vi.clearAllMocks();
            // Restore stable defaults cleared by vi.clearAllMocks().
            mockPeekAnalysisCache.mockResolvedValue(null);
            mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        });

        it('branch-taken: degraded + non-US ticker shape calls notFound()', async () => {
            // 1INCHUSD starts with a digit → fails VALID_TICKER_RE (^[A-Z]…)
            // and represents a crypto symbol that cannot be resolved when both
            // crypto_assets DB and FMP are down simultaneously.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: '1INCHUSD', name: '1inch' },
                degraded: true,
            } as never);

            await SymbolPage({
                params: Promise.resolve({ symbol: '1INCHUSD' }),
            });

            expect(mockNotFound).toHaveBeenCalled();
        });

        it('branch-not-taken: degraded + valid US ticker shape does NOT call notFound() for the degraded gate', async () => {
            // AAPL passes VALID_TICKER_RE: a US equity that is temporarily
            // degraded due to FMP downtime should continue to render (with
            // the existing noindex metadata guard), not 404.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    fmpSymbol: 'AAPL',
                },
                degraded: true,
            } as never);

            await SymbolPage({
                params: Promise.resolve({ symbol: 'AAPL' }),
            });

            expect(mockNotFound).not.toHaveBeenCalled();
        });
    });
});
