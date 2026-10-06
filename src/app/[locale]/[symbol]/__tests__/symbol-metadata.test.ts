/**
 * generateMetadata 회귀 테스트 — canonical URL에 [symbol] 플레이스홀더가 누출되지 않는지 검증.
 *
 * page.tsx 파일들은 RSC 컨텍스트와 많은 인프라 의존성을 가지므로,
 * generateMetadata에서 직접 호출하는 외부 의존성만 최소한으로 모킹한다.
 */

// 'server-only'는 Next 런타임 sentinel이라 Jest 환경에서 해석 불가 — virtual mock
vi.mock('server-only', () => ({}));

// react-markdown은 ESM-only 패키지라 Jest 환경에서 파싱 불가 — 컴포넌트 전체를 stub
vi.mock('react-markdown', () => ({ default: () => null }));

// page.tsx → SymbolPageClient → AnalysisPanel → MarkdownText 체인을 끊기 위해 컴포넌트를 stub
vi.mock('@/views/symbol/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummary', () => ({
    FundamentalAiSummary: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => null,
}));
vi.mock('@/widgets/fundamental/FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => null,
}));
vi.mock('@/widgets/fundamental/sections/FinancialHealthCard', () => ({
    FinancialHealthCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/FutureDirectionCard', () => ({
    FutureDirectionCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/GrowthChart', () => ({
    GrowthChart: () => null,
}));
vi.mock('@/widgets/fundamental/sections/PeersTable', () => ({
    PeersTable: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ProfileCard', () => ({
    ProfileCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ProfitabilityCard', () => ({
    ProfitabilityCard: () => null,
}));
vi.mock('@/widgets/fundamental/sections/ValuationCard', () => ({
    ValuationCard: () => null,
}));
vi.mock('@/views/symbol/SectionSkeleton', () => ({
    SectionSkeleton: () => null,
}));
vi.mock('@/widgets/news/NewsAiSummary', () => ({
    NewsAiSummary: () => null,
}));
vi.mock('@/widgets/news/NewsAiSummaryErrorBoundary', () => ({
    NewsAiSummaryErrorBoundary: () => null,
}));
vi.mock('@/widgets/news/NewsAiSummarySkeleton', () => ({
    NewsAiSummarySkeleton: () => null,
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    AnalystActions: () => null,
}));
vi.mock('@/widgets/news/sections/EventCalendar', () => ({
    EventCalendar: () => null,
}));
vi.mock('@/widgets/news/sections/NewsList', () => ({
    NewsList: () => null,
}));
vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/fear-greed/FearGreedPage', () => ({
    FearGreedPage: () => null,
}));

vi.mock('@/widgets/options/OptionsPageClient', () => ({
    OptionsPageClient: () => null,
}));
vi.mock('@/widgets/options/OptionsEmptyState', () => ({
    OptionsEmptyState: () => null,
}));
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    hasOptionsMarket: vi.fn().mockResolvedValue(true),
    fetchOptionsSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/app/[locale]/[symbol]/fundamental/fundamentalData', () => ({
    getAnalystEstimates: vi.fn(),
    getCashFlowStatement: vi.fn(),
    getFinancialScores: vi.fn(),
    getGradesConsensus: vi.fn(),
    getIncomeStatementGrowth: vi.fn(),
    getKeyMetricsTtm: vi.fn(),
    getPriceTargetConsensus: vi.fn(),
    getPriceTargetSummary: vi.fn(),
    getProfile: vi.fn(() => Promise.resolve(null)),
    getProfileDescriptionKo: vi.fn(),
    getRatiosTtm: vi.fn(),
    getStockPeers: vi.fn(),
}));

vi.mock('@/app/[locale]/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: vi.fn(),
    getGradeEvents: vi.fn(),
    getNewsList: vi.fn(() => Promise.resolve([])),
}));

const { mockGetAssetInfoResilient, mockGetProfileResilient } = vi.hoisted(
    () => ({
        mockGetAssetInfoResilient: vi.fn(),
        mockGetProfileResilient: vi.fn(),
    })
);

// isTabAllowedForSymbol is called in options/page.tsx generateMetadata (crypto soft-404 guard).
// In this test all symbols are treated as equity (tab allowed = true) so the guard passes
// and the degraded/null branches below are exercised as before.
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    // assetInfo가 존재하는 happy-path에서 generateMetadata가 호출한다. canonical은
    // ticker(params) 기반이라 displayName 정확도는 회귀 검증과 무관 — 간단 stub으로 충분.
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: (
        info: { name?: string; koreanName?: string } | null,
        ticker: string
    ) => info?.koreanName ?? info?.name ?? ticker,
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    // page.tsx 본문이 import(generateMetadata 경로에선 미사용)하므로 stub만 제공.
    buildAssetAboutNode: vi.fn(() => undefined),
}));

vi.mock(
    '@/entities/symbol-indexability/lib/evaluateSymbolIndexability',
    () => ({
        evaluateSymbolIndexability: vi.fn(() => ({
            indexable: true,
            reason: 'popular',
        })),
    })
);

// fundamental 페이지 본문이 import한다. generateMetadata는 2026-10-01부터 호출하지 않는다
// (항상 noindex라 profile 게이트가 사라졌다).
vi.mock('@/entities/ticker/lib/getProfileResilient', () => ({
    getProfileResilient: mockGetProfileResilient,
}));

// react.cache는 Node 환경에서 identity wrapper로 대체
vi.mock('react', async () => ({
    ...(await vi.importActual('react')),
    cache: (fn: unknown) => fn,
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NOT_FOUND');
    }),
}));

// 페이지 본문에서 쓰는 인프라 — generateMetadata에는 필요 없지만 import chain에서 로드될 수 있음
vi.mock('@/entities/bars/actions/getBarsAction', () => ({
    getBarsAction: vi.fn(),
}));

/**
 * 차트·fear-greed의 `generateMetadata`는 봉을 읽어 콘텐츠 게이트에 넘긴다.
 * 조회가 실패하면(목이 없으면) 그 렌더는 degrade로 간주돼 noindex + canonical
 * null이 된다 — 이 파일의 관심사는 canonical URL이므로 정상 봉을 준다.
 */
vi.mock('@/entities/bars/lib/barsStaticCache', () => {
    // vi.mock은 hoist되므로 픽스처를 팩토리 **안**에 둔다.
    const barsFixture = {
        bars: [
            { time: 1, open: 1, high: 2, low: 1, close: 1, volume: 10 },
            { time: 2, open: 1, high: 3, low: 1, close: 2, volume: 10 },
        ],
        indicators: {
            rsi: [50, 55],
            macd: [{ histogram: 0.2 }],
            buySellVolume: [],
        },
    };
    return {
        getQuantizedBarsStatic: vi.fn().mockResolvedValue(barsFixture),
        getSeedBarsStatic: vi.fn().mockResolvedValue(barsFixture),
    };
});
// fear-greed 탭의 `generateMetadata`는 세션 키 축소 봉(`getSessionBarsStatic`)을 읽는다.
vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    getSessionBarsStatic: vi.fn().mockResolvedValue({
        bars: [
            { time: 1, open: 1, high: 2, low: 1, close: 1, volume: 10 },
            { time: 2, open: 1, high: 3, low: 1, close: 2, volume: 10 },
        ],
        indicators: { buySellVolume: [] },
    }),
}));

vi.mock('@/entities/skill/api', () => ({
    countSkillFiles: vi.fn(() => Promise.resolve({ indicators: 13 })),
}));

vi.mock(
    '@/entities/news-article/actions/ensureNewsCardsAnalyzedAction',
    () => ({
        ensureNewsCardsAnalyzedAction: vi.fn(() => Promise.resolve()),
    })
);

// tanstack query (페이지 default export에서 사용, generateMetadata에는 불필요)
// `/news`는 산문·감정 카드가 둘 다 없으면 noindex다. 이 파일의 관심사는 canonical
// URL이지 색인성이 아니므로, 그 게이트를 통과할 최소 픽스처를 준다. (`/overall`·
// `/fundamental`은 2026-10-01부터 항상 noindex라 스냅샷을 읽지 않는다.)
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([
        // `/news`도 산문·감정 카드가 둘 다 없으면 noindex다.
        {
            symbol: 'AAPL',
            tab: 'news',
            content: { currentDriverKo: '테스트용 뉴스 동인' },
            model: 'deepseek-v4.1-flash',
            generatedAt: new Date(),
            updatedAt: new Date(),
        },
    ]),
}));

vi.mock('@tanstack/react-query', () => ({
    QueryClient: vi.fn().mockImplementation(function () {
        return {
            setQueryData: vi.fn(),
            prefetchQuery: vi.fn(() => Promise.resolve()),
        };
    }),
    HydrationBoundary: ({ children }: { children: React.ReactNode }) =>
        children,
    dehydrate: vi.fn(() => ({})),
}));

import { generateMetadata as generateSymbolMetadata } from '@/app/[locale]/[symbol]/page';
import { generateMetadata as generateFundamentalMetadata } from '@/app/[locale]/[symbol]/fundamental/page';
import { generateMetadata as generateNewsMetadata } from '@/app/[locale]/[symbol]/news/page';
import { generateMetadata as generateOverallMetadata } from '@/app/[locale]/[symbol]/overall/page';
import { generateMetadata as generateFearGreedMetadata } from '@/app/[locale]/[symbol]/fear-greed/page';
import { generateMetadata as generateOptionsMetadata } from '@/app/[locale]/[symbol]/options/page';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability/lib/evaluateSymbolIndexability';
import type { MockedFunction } from 'vitest';
import type { Metadata } from 'next';

/**
 * noindex 분기의 canonical은 `null`도, 루트 레이아웃의 홈도 아니라 **자기 URL**이다
 * (`og:url`과 같은 값). 항상-noindex 탭과 같은 방식으로 통일했다.
 */
function expectSelfCanonical(metadata: Metadata): void {
    const canonical = metadata.alternates?.canonical;
    expect(canonical).not.toBeNull();
    expect(canonical).not.toBe('https://siglens.io');
    expect(canonical).toBe(metadata.openGraph?.url);
}

const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;

function makeParams(
    symbol: string,
    locale = 'ko'
): { params: Promise<{ locale: string; symbol: string }> } {
    return { params: Promise.resolve({ locale, symbol }) };
}

function makeParamsWithSearch(
    symbol: string,
    searchParams: Record<string, string> = {},
    locale = 'ko'
): {
    params: Promise<{ locale: string; symbol: string }>;
    searchParams: Promise<Record<string, string>>;
} {
    return {
        params: Promise.resolve({ locale, symbol }),
        searchParams: Promise.resolve(searchParams),
    };
}

describe('generateMetadata — canonical URL 회귀 가드', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // happy-path 기본값: 실존하는 종목(assetInfo 존재, 비-degraded).
        // canonical은 ticker(params) 기반이라 assetInfo 유무와 무관하므로,
        // 회귀 가드(플레이스홀더 누출)에는 generic assetInfo로 충분하다.
        // 실존하지 않는 ticker(assetInfo: null) 경로는 아래 별도 describe에서 검증.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'Apple Inc.' },
            degraded: false,
        });
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

    describe('[symbol] 루트 페이지 (/AAPL)', () => {
        it('소문자 입력 aapl → canonical이 /AAPL (대문자, 플레이스홀더 없음)', async () => {
            const metadata = await generateSymbolMetadata(
                makeParamsWithSearch('aapl')
            );
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL'
            );
            expect(metadata.alternates?.canonical).not.toMatch(/\[symbol\]/i);
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                metadata.alternates?.canonical
            );
        });

        it('대문자 TSLA → canonical이 /TSLA', async () => {
            const metadata = await generateSymbolMetadata(
                makeParamsWithSearch('TSLA')
            );
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/TSLA'
            );
        });

        it('central indexability gate blocks unapproved longtail with noindex + self-canonical', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: '0NEUSD', name: 'Stone USD' },
                degraded: false,
            });
            mockEvaluateSymbolIndexability.mockReturnValueOnce({
                indexable: false,
                reason: 'longtail-default-blocked',
            });

            const metadata = await generateSymbolMetadata(
                makeParamsWithSearch('0NEUSD')
            );

            expect(metadata.robots).toEqual({ index: false, follow: true });
            expectSelfCanonical(metadata);
        });
    });

    describe('central indexability gate — symbol sibling routes', () => {
        it.each([
            { name: 'fundamental', generate: generateFundamentalMetadata },
            { name: 'news', generate: generateNewsMetadata },
            { name: 'overall', generate: generateOverallMetadata },
            { name: 'fear-greed', generate: generateFearGreedMetadata },
            { name: 'options', generate: generateOptionsMetadata },
        ])(
            '$name 페이지도 unapproved longtail을 noindex 처리한다',
            async ({ generate }) => {
                mockGetAssetInfoResilient.mockResolvedValue({
                    assetInfo: { symbol: '0NEUSD', name: 'Stone USD' },
                    degraded: false,
                });
                mockEvaluateSymbolIndexability.mockReturnValueOnce({
                    indexable: false,
                    reason: 'longtail-default-blocked',
                });

                const metadata = await generate(makeParams('0NEUSD'));

                expect(metadata.robots).toEqual({
                    index: false,
                    follow: true,
                });
                expectSelfCanonical(metadata);
            }
        );
    });

    // 펀더멘털·종합 탭은 항상 noindex지만 self-canonical·og:url은 남는다(2026-10-01).
    describe('[symbol]/fundamental 페이지 (/AAPL/fundamental)', () => {
        it('소문자 aapl → noindex이되 canonical이 /AAPL/fundamental', async () => {
            const metadata = await generateFundamentalMetadata(
                makeParams('aapl')
            );
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/fundamental'
            );
            expect(metadata.alternates?.canonical).not.toMatch(/\[symbol\]/i);
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                metadata.alternates?.canonical
            );
        });
    });

    describe('[symbol]/news 페이지 (/AAPL/news)', () => {
        it('소문자 aapl → canonical이 /AAPL/news', async () => {
            const metadata = await generateNewsMetadata(makeParams('aapl'));
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/news'
            );
            expect(metadata.alternates?.canonical).not.toMatch(/\[symbol\]/i);
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                metadata.alternates?.canonical
            );
        });
    });

    describe('[symbol]/overall 페이지 (/AAPL/overall)', () => {
        it('소문자 aapl → noindex이되 canonical이 /AAPL/overall', async () => {
            const metadata = await generateOverallMetadata(
                makeParamsWithSearch('aapl')
            );
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/overall'
            );
            expect(metadata.alternates?.canonical).not.toMatch(/\[symbol\]/i);
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                metadata.alternates?.canonical
            );
        });
    });

    // 종목별 공포·탐욕 탭은 2026-10-01부터 색인한다 — self-canonical이 대문자로
    // 정규화되고 robots 오버라이드가 없다(봉이 정상인 인기 종목 기준).
    describe('[symbol]/fear-greed 페이지 (/AAPL/fear-greed)', () => {
        it('소문자 aapl → 색인 가능, canonical·og:url 모두 /AAPL/fear-greed', async () => {
            const metadata = await generateFearGreedMetadata(
                makeParams('aapl')
            );
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/fear-greed'
            );
            expect(metadata.robots).toBeUndefined();
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                'https://siglens.io/AAPL/fear-greed'
            );
        });
    });

    describe('타이틀에 [SYMBOL] 플레이스홀더 누출 없음 — 전 라우트', () => {
        const cases = [
            {
                name: '[symbol] 루트',
                fn: () => generateSymbolMetadata(makeParamsWithSearch('BRK.B')),
                expectedCanonical: 'https://siglens.io/BRK.B',
            },
            {
                name: 'fundamental',
                fn: () => generateFundamentalMetadata(makeParams('msft')),
                expectedCanonical: 'https://siglens.io/MSFT/fundamental',
            },
            {
                name: 'news',
                fn: () => generateNewsMetadata(makeParams('nvda')),
                expectedCanonical: 'https://siglens.io/NVDA/news',
            },
            {
                name: 'overall',
                fn: () => generateOverallMetadata(makeParamsWithSearch('amzn')),
                expectedCanonical: 'https://siglens.io/AMZN/overall',
            },
            {
                name: 'fear-greed',
                fn: () => generateFearGreedMetadata(makeParams('tsla')),
                expectedCanonical: 'https://siglens.io/TSLA/fear-greed',
            },
        ] as const;

        it.each(cases)(
            '$name — title과 canonical URL 모두 올바르다',
            async ({ fn, expectedCanonical }) => {
                const metadata = await fn();
                const serialized = JSON.stringify(metadata);
                expect(serialized).not.toMatch(/\[symbol\]/i);
                expect(metadata.alternates?.canonical).toBe(expectedCanonical);
            }
        );
    });

    describe('variant noindex 제거 — clean canonical 통합', () => {
        // 최상위 beforeEach가 실존 종목(assetInfo 존재)으로 설정 → 정상 index 메타데이터.
        // variant noindex 제거 검증에는 tf searchParam이 robots를 바꾸지 않음만 보면 된다.
        it('overall: tf variant여도 canonical은 clean (이 탭은 variant와 무관하게 항상 noindex)', async () => {
            const metadata = await generateOverallMetadata(
                makeParamsWithSearch('aapl', { tf: '1Hour' })
            );
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/overall'
            );
        });
    });

    describe('degraded fallback — noindex 전 라우트', () => {
        /**
         * 인프라 실패로 getAssetInfoResilient가 degraded:true를 반환할 때,
         * 각 라우트의 generateMetadata가 noindex로 응답하는지 검증한다.
         * (MISTAKES.md §18: 신규 조건 분기는 true/false 두 경로 모두 커버)
         */
        const degradedCases = [
            {
                name: '[symbol] 루트',
                fn: () => generateSymbolMetadata(makeParamsWithSearch('aapl')),
            },
            {
                name: 'news',
                fn: () => generateNewsMetadata(makeParams('aapl')),
            },
            {
                name: 'fundamental',
                fn: () => generateFundamentalMetadata(makeParams('aapl')),
            },
            {
                name: 'options',
                fn: () => generateOptionsMetadata(makeParams('aapl')),
            },
            {
                name: 'fear-greed',
                fn: () => generateFearGreedMetadata(makeParams('aapl')),
            },
            {
                name: 'overall',
                fn: () => generateOverallMetadata(makeParamsWithSearch('aapl')),
            },
        ] as const;

        beforeEach(() => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'AAPL', name: 'AAPL' },
                degraded: true,
            });
        });

        it.each(degradedCases)(
            '$name — degraded 시 noindex 반환',
            async ({ fn }) => {
                const metadata = await fn();
                expect(metadata.robots).toEqual({
                    index: false,
                    follow: true,
                });
                // M1: degraded/invalid noindex는 루트 레이아웃의 home canonical을
                // 상속하지 않는다 — 자기 URL을 가리키는 self-canonical이다(2026-10-05).
                expectSelfCanonical(metadata);
            }
        );
    });

    describe('실존하지 않는 ticker (assetInfo null) — 전 라우트가 notFound()', () => {
        /**
         * 형식은 유효하나 FMP에 실재하지 않는 ticker는 getAssetInfoResilient가
         * { assetInfo: null, degraded: false }를 반환한다. 레이아웃은 `notFound()`로
         * 404를 내보내는데, generateMetadata가 티커를 단 noindex 메타데이터를 돌려주면
         * **404 응답에 정상 페이지 제목**(`ZZZQ 기술적 분석 …`)이 얹힌다(2026-10-05 감사).
         * 같은 판정(`requireResolvableAsset`)으로 메타데이터도 `notFound()`를 던져
         * 404 경계의 제목이 쓰이게 한다.
         *
         * 이 목록을 줄이면 해당 탭만 티커 제목의 404로 돌아간다 — 탭이 늘면 여기도 늘린다.
         */
        const nonExistentCases = [
            {
                name: '[symbol] 루트',
                fn: (symbol: string) =>
                    generateSymbolMetadata(makeParamsWithSearch(symbol)),
            },
            {
                name: 'news',
                fn: (symbol: string) =>
                    generateNewsMetadata(makeParams(symbol)),
            },
            {
                name: 'fundamental',
                fn: (symbol: string) =>
                    generateFundamentalMetadata(makeParams(symbol)),
            },
            {
                name: 'options',
                fn: (symbol: string) =>
                    generateOptionsMetadata(makeParams(symbol)),
            },
            {
                name: 'fear-greed',
                fn: (symbol: string) =>
                    generateFearGreedMetadata(makeParams(symbol)),
            },
            {
                name: 'overall',
                fn: (symbol: string) =>
                    generateOverallMetadata(makeParamsWithSearch(symbol)),
            },
        ] as const;

        it.each(nonExistentCases)(
            '$name — assetInfo null 시 notFound()',
            async ({ fn }) => {
                mockGetAssetInfoResilient.mockResolvedValue({
                    assetInfo: null,
                    degraded: false,
                });

                await expect(fn('zzzq')).rejects.toThrow('NOT_FOUND');
                expect(mockEvaluateSymbolIndexability).not.toHaveBeenCalled();
            }
        );

        it.each(nonExistentCases)(
            '$name — FMP·DB 동시 장애 중 형상도 못 살리는 심볼은 notFound()',
            async ({ fn }) => {
                // 숫자로 시작하는 크립토 — `isUnresolvableDegraded`가 장애 중에는 존재를
                // 확인할 수 없다고 본다. 레이아웃이 404를 내므로 메타데이터도 같아야 한다.
                mockGetAssetInfoResilient.mockResolvedValue({
                    assetInfo: { symbol: '1INCHUSD', name: '1INCHUSD' },
                    degraded: true,
                });

                await expect(fn('1inchusd')).rejects.toThrow('NOT_FOUND');
            }
        );
    });

    describe('항상 noindex 탭 — 데이터 상태와 무관하다 (2026-10-01)', () => {
        it('fundamental: profile 조회 없이 noindex + self-canonical', async () => {
            const metadata = await generateFundamentalMetadata(
                makeParams('aapl')
            );
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/fundamental'
            );
            expect(mockGetProfileResilient).not.toHaveBeenCalled();
        });
    });
});
