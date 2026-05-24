/**
 * generateMetadata 회귀 테스트 — canonical URL에 [symbol] 플레이스홀더가 누출되지 않는지 검증.
 *
 * page.tsx 파일들은 RSC 컨텍스트와 많은 인프라 의존성을 가지므로,
 * generateMetadata에서 직접 호출하는 외부 의존성만 최소한으로 모킹한다.
 */

// release-it 경유 실행 시 `.env.local`의 NEXT_PUBLIC_SITE_URL(=dev URL)이 부모 프로세스에
// 주입되어 generateMetadata가 'http://localhost:4200/...'을 canonical로 만들 수 있다.
// production URL 회귀가드 의도를 보존하기 위해 import 평가 전에 강제 세팅한다.
//
// 이 패턴의 안전성은 ts-jest의 CommonJS transform에 의존한다 — ES `import`가 `require()`로
// lowering되어 코드 순서대로 평가되므로, 이 줄이 page module evaluation 전에 실행된다.
// Babel 전환·`isolatedModules`+ESM output으로 바꾸면 import hoisting이 깨질 수 있으니
// 그때는 jest.mock 패턴으로 옮겨야 한다.
process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.io';

// 'server-only'는 Next 런타임 sentinel이라 Jest 환경에서 해석 불가 — virtual mock
jest.mock('server-only', () => ({}), { virtual: true });

// react-markdown은 ESM-only 패키지라 Jest 환경에서 파싱 불가 — 컴포넌트 전체를 stub
jest.mock('react-markdown', () => () => null);

// page.tsx → SymbolPageClient → AnalysisPanel → MarkdownText 체인을 끊기 위해 컴포넌트를 stub
jest.mock('@/components/symbol-page/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
jest.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: () => null,
}));
jest.mock('@/components/symbol-page/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
jest.mock('@/components/fundamental/FundamentalAiSummary', () => ({
    FundamentalAiSummary: () => null,
}));
jest.mock('@/components/fundamental/FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => null,
}));
jest.mock('@/components/fundamental/FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => null,
}));
jest.mock('@/components/fundamental/sections/FinancialHealthCard', () => ({
    FinancialHealthCard: () => null,
}));
jest.mock('@/components/fundamental/sections/FutureDirectionCard', () => ({
    FutureDirectionCard: () => null,
}));
jest.mock('@/components/fundamental/sections/GrowthChart', () => ({
    GrowthChart: () => null,
}));
jest.mock('@/components/fundamental/sections/PeersTable', () => ({
    PeersTable: () => null,
}));
jest.mock('@/components/fundamental/sections/ProfileCard', () => ({
    ProfileCard: () => null,
}));
jest.mock('@/components/fundamental/sections/ProfitabilityCard', () => ({
    ProfitabilityCard: () => null,
}));
jest.mock('@/components/fundamental/sections/ValuationCard', () => ({
    ValuationCard: () => null,
}));
jest.mock('@/components/symbol-page/SectionSkeleton', () => ({
    SectionSkeleton: () => null,
}));
jest.mock('@/components/news/NewsAiSummary', () => ({
    NewsAiSummary: () => null,
}));
jest.mock('@/components/news/NewsAiSummaryErrorBoundary', () => ({
    NewsAiSummaryErrorBoundary: () => null,
}));
jest.mock('@/components/news/NewsAiSummarySkeleton', () => ({
    NewsAiSummarySkeleton: () => null,
}));
jest.mock('@/components/news/sections/AnalystActions', () => ({
    AnalystActions: () => null,
}));
jest.mock('@/components/news/sections/EventCalendar', () => ({
    EventCalendar: () => null,
}));
jest.mock('@/components/news/sections/NewsList', () => ({
    NewsList: () => null,
}));
jest.mock('@/components/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
jest.mock('@/components/fear-greed/FearGreedPage', () => ({
    FearGreedPage: () => null,
}));

jest.mock('@/app/[symbol]/fundamental/fundamentalData', () => ({
    getAnalystEstimates: jest.fn(),
    getCashFlowStatement: jest.fn(),
    getFinancialScores: jest.fn(),
    getGradesConsensus: jest.fn(),
    getIncomeStatementGrowth: jest.fn(),
    getKeyMetricsTtm: jest.fn(),
    getPriceTargetConsensus: jest.fn(),
    getPriceTargetSummary: jest.fn(),
    getProfile: jest.fn(() => Promise.resolve(null)),
    getProfileDescriptionKo: jest.fn(),
    getRatiosTtm: jest.fn(),
    getStockPeers: jest.fn(),
}));

jest.mock('@/app/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: jest.fn(),
    getGradeEvents: jest.fn(),
    getNewsList: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: jest.fn(() => '2026-05-21'),
}));

jest.mock('@/domain/fearGreed/classifier', () => ({
    FEAR_GREED_SCORE_BOUNDARIES: {},
}));

const mockGetAssetInfoCached = jest.fn();

jest.mock('@/infrastructure/ticker/getAssetInfoCached', () => ({
    getAssetInfoCached: (...args: unknown[]) => mockGetAssetInfoCached(...args),
}));

// react.cache는 Node 환경에서 identity wrapper로 대체
jest.mock('react', () => ({
    ...jest.requireActual('react'),
    cache: (fn: unknown) => fn,
}));

jest.mock('next/navigation', () => ({
    notFound: jest.fn(() => {
        throw new Error('NOT_FOUND');
    }),
}));

// 페이지 본문에서 쓰는 인프라 — generateMetadata에는 필요 없지만 import chain에서 로드될 수 있음
jest.mock('@/entities/bars/actions', () => ({
    getBarsAction: jest.fn(),
}));

jest.mock('@/entities/skill', () => ({
    countSkillFiles: jest.fn(() => Promise.resolve({ indicators: 13 })),
}));

jest.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: jest.fn(() => Promise.resolve()),
}));

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

// tanstack query (페이지 default export에서 사용, generateMetadata에는 불필요)
jest.mock('@tanstack/react-query', () => ({
    QueryClient: jest.fn().mockImplementation(() => ({
        setQueryData: jest.fn(),
        prefetchQuery: jest.fn(() => Promise.resolve()),
    })),
    HydrationBoundary: ({ children }: { children: React.ReactNode }) =>
        children,
    dehydrate: jest.fn(() => ({})),
}));

import { generateMetadata as generateSymbolMetadata } from '@/app/[symbol]/page';
import { generateMetadata as generateFundamentalMetadata } from '@/app/[symbol]/fundamental/page';
import { generateMetadata as generateNewsMetadata } from '@/app/[symbol]/news/page';
import { generateMetadata as generateOverallMetadata } from '@/app/[symbol]/overall/page';
import { generateMetadata as generateFearGreedMetadata } from '@/app/[symbol]/fear-greed/page';

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
        jest.clearAllMocks();
        // assetInfo null 반환 → ticker fallback 경로 검증
        mockGetAssetInfoCached.mockResolvedValue(null);
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
});
