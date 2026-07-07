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

vi.mock('@/app/[symbol]/fundamental/fundamentalData', () => ({
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

vi.mock('@/app/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: vi.fn(),
    getGradeEvents: vi.fn(),
    getNewsList: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: vi.fn(() => '2026-05-21'),
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

vi.mock('@/entities/ticker', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
    // assetInfo가 존재하는 happy-path에서 generateMetadata가 호출한다. canonical은
    // ticker(params) 기반이라 displayName 정확도는 회귀 검증과 무관 — 간단 stub으로 충분.
    buildDisplayName: (
        info: { name?: string; koreanName?: string } | null,
        ticker: string
    ) => info?.koreanName ?? info?.name ?? ticker,
    // page.tsx 본문이 import(generateMetadata 경로에선 미사용)하므로 stub만 제공.
    buildAssetAboutNode: vi.fn(() => undefined),
}));

vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: vi.fn(() => ({
        indexable: true,
        reason: 'popular',
    })),
}));

// fundamental generateMetadata는 noindex 게이트로 getProfileResilient를 호출한다.
vi.mock('@/app/[symbol]/fundamental/getProfileResilient', () => ({
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
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn(() => Promise.resolve({ indicators: 13 })),
}));

vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: vi.fn(() => Promise.resolve()),
}));

// tanstack query (페이지 default export에서 사용, generateMetadata에는 불필요)
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

import { generateMetadata as generateSymbolMetadata } from '@/app/[symbol]/page';
import { generateMetadata as generateFundamentalMetadata } from '@/app/[symbol]/fundamental/page';
import { generateMetadata as generateNewsMetadata } from '@/app/[symbol]/news/page';
import { generateMetadata as generateOverallMetadata } from '@/app/[symbol]/overall/page';
import { generateMetadata as generateFearGreedMetadata } from '@/app/[symbol]/fear-greed/page';
import { generateMetadata as generateOptionsMetadata } from '@/app/[symbol]/options/page';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import type { MockedFunction } from 'vitest';

const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;

function makeParams(symbol: string): { params: Promise<{ symbol: string }> } {
    return { params: Promise.resolve({ symbol }) };
}

function makeParamsWithSearch(
    symbol: string,
    searchParams: Record<string, string> = {}
): {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<Record<string, string>>;
} {
    return {
        params: Promise.resolve({ symbol }),
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
        // fundamental의 noindex 게이트 기본값: profile 존재 + 비-degraded(정상 happy-path).
        mockGetProfileResilient.mockResolvedValue({
            profile: { symbol: 'AAPL' },
            degraded: false,
        });
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

        it('central indexability gate blocks unapproved longtail with noindex + canonical null', async () => {
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

            expect(metadata.robots).toEqual({ index: false, follow: false });
            expect(metadata.alternates?.canonical).toBeNull();
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
                    follow: false,
                });
                expect(metadata.alternates?.canonical).toBeNull();
            }
        );
    });

    describe('[symbol]/fundamental 페이지 (/AAPL/fundamental)', () => {
        it('소문자 aapl → canonical이 /AAPL/fundamental', async () => {
            const metadata = await generateFundamentalMetadata(
                makeParams('aapl')
            );
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
        it('소문자 aapl → canonical이 /AAPL/overall', async () => {
            const metadata = await generateOverallMetadata(
                makeParamsWithSearch('aapl')
            );
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

    describe('[symbol]/fear-greed 페이지 (/AAPL/fear-greed)', () => {
        it('소문자 aapl → canonical이 /AAPL/fear-greed', async () => {
            const metadata = await generateFearGreedMetadata(
                makeParams('aapl')
            );
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL/fear-greed'
            );
            expect(metadata.alternates?.canonical).not.toMatch(/\[symbol\]/i);
            expect(String(metadata.title)).not.toMatch(/\[SYMBOL\]/i);
            expect(metadata.openGraph?.url).toBe(
                metadata.alternates?.canonical
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
        it('overall: tf variant여도 noindex 없음, canonical은 clean', async () => {
            const metadata = await generateOverallMetadata(
                makeParamsWithSearch('aapl', { tf: '1Hour' })
            );
            expect(metadata.robots).toBeUndefined();
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
                    follow: false,
                });
                // M1: degraded/invalid noindex는 루트 레이아웃의 home canonical을
                // 상속하지 않는다(canonical: null로 omit).
                expect(metadata.alternates?.canonical).toBeNull();
            }
        );
    });

    describe('실존하지 않는 ticker (assetInfo null) — noindex 전 라우트', () => {
        /**
         * 형식은 유효하나 FMP에 실재하지 않는 ticker는 getAssetInfoResilient가
         * { assetInfo: null, degraded: false }를 반환한다. 본문은 `if (!assetInfo)
         * notFound()`로 404/not-found(noindex)를 렌더하므로, generateMetadata도 noindex +
         * canonical null로 맞춰야 한다. 가드가 없으면 한 페이지에 robots index(메타)와
         * noindex(not-found)가 충돌하고 존재하지 않는 URL을 canonical로 자기참조하는
         * soft-404가 발생한다 (실측: HTTP 200 + robots ['index, follow', 'noindex']).
         *
         * fundamental은 제외 — 실재성 게이트가 assetInfo가 아닌 getProfileResilient의
         * profile===null이며, 아래 별도 describe에서 검증한다.
         */
        const nonExistentCases = [
            {
                name: '[symbol] 루트',
                fn: () => generateSymbolMetadata(makeParamsWithSearch('zzzq')),
            },
            {
                name: 'news',
                fn: () => generateNewsMetadata(makeParams('zzzq')),
            },
            {
                name: 'options',
                fn: () => generateOptionsMetadata(makeParams('zzzq')),
            },
            {
                name: 'fear-greed',
                fn: () => generateFearGreedMetadata(makeParams('zzzq')),
            },
            {
                name: 'overall',
                fn: () => generateOverallMetadata(makeParamsWithSearch('zzzq')),
            },
        ] as const;

        beforeEach(() => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: null,
                degraded: false,
            });
        });

        it.each(nonExistentCases)(
            '$name — assetInfo null 시 noindex + canonical null',
            async ({ fn }) => {
                const metadata = await fn();
                expect(metadata.robots).toEqual({
                    index: false,
                    follow: false,
                });
                expect(metadata.alternates?.canonical).toBeNull();
            }
        );
    });

    describe('fundamental — profile 인프라 실패/부재 시 noindex (본문 결과와 일치)', () => {
        it('profile degraded(FMP 인프라 실패) → noindex + canonical null', async () => {
            mockGetProfileResilient.mockResolvedValue({
                profile: null,
                degraded: true,
            });
            const metadata = await generateFundamentalMetadata(
                makeParams('aapl')
            );
            expect(metadata.robots).toEqual({ index: false, follow: false });
            expect(metadata.alternates?.canonical).toBeNull();
        });

        it('profile null(실존하지 않는 종목) → noindex (본문 notFound와 짝)', async () => {
            mockGetProfileResilient.mockResolvedValue({
                profile: null,
                degraded: false,
            });
            const metadata = await generateFundamentalMetadata(
                makeParams('aapl')
            );
            expect(metadata.robots).toEqual({ index: false, follow: false });
            expect(metadata.alternates?.canonical).toBeNull();
        });
    });
});
