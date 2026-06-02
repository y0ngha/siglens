/**
 * generateMetadata 회귀 테스트 — canonical URL에 [symbol] 플레이스홀더가 누출되지 않는지 검증.
 *
 * page.tsx 파일들은 RSC 컨텍스트와 많은 인프라 의존성을 가지므로,
 * generateMetadata에서 직접 호출하는 외부 의존성만 최소한으로 모킹한다.
 */

// 'server-only'는 Next 런타임 sentinel이라 Jest 환경에서 해석 불가 — virtual mock
vi.mock('server-only', () => ({}));

// react-markdown은 ESM-only 패키지라 Jest 환경에서 파싱 불가 — 컴포넌트 전체를 stub
vi.mock('react-markdown', () => () => null);

// page.tsx → SymbolPageClient → AnalysisPanel → MarkdownText 체인을 끊기 위해 컴포넌트를 stub
vi.mock('@/widgets/symbol-page/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: () => null,
}));
vi.mock('@/widgets/symbol-page/CrossLinkCards', () => ({
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
vi.mock('@/widgets/symbol-page/SectionSkeleton', () => ({
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

const { mockGetAssetInfoResilient } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
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

vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn(),
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
        // assetInfo null 반환 → ticker fallback 경로 검증
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
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
        // 최상위 beforeEach가 assetInfo=null로 설정 → buildDisplayName 미호출
        // (ticker fallback). variant noindex 제거 검증에는 assetInfo 유무가 무관하다.
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
            }
        );
    });
});
