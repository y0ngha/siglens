import type {
    AgentHistoryIndex,
    MarketDailyClose,
    MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { vi } from 'vitest';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import type { AssetInfo } from '@/shared/lib/types';
import {
    closedDailyCloses,
    sessionOpenNow,
    syntheticProvider,
    type SeriesSpec,
    type SyntheticMarketWorld,
} from './syntheticMarket';

/**
 * 골든 테스트의 데이터 경계. `toolGolden.test.ts`의 `vi.mock`은 모두 이 파일의 `MOCKED_MODULES`를 가리키고, 각 사례는
 * `world`(합성 시장·자산)와 `fakes`(경계 함수)만 바꾼다.
 *
 * 목은 도구 이동 PR이 옮기지 않는 모듈에만 건다(`src/shared/**`, 엔티티의 `server/`·`api`·`actions`, 외부 패키지).
 * `src/app/api/ai/chat/**`는 한 줄도 목하지 않는다 — 그 폴더는 도구 이동 PR이 통째로 옮기므로, 거기에 목을
 * 걸면 이동 PR에서 골든 테스트의 본문이 바뀌어 "출력이 그대로"라는 증명이 무너진다. 메타 테스트가 이 규칙을 지킨다.
 *
 * 기본 구현은 운영의 "비어 있음"(빈 목록·`null`)이다. `vi.resetAllMocks()`는 `vi.fn(impl)`의 `impl`로 되돌리므로
 * 사례마다 다시 기본값에서 시작한다.
 */
export interface GoldenWorld extends SyntheticMarketWorld {
    assets: Record<string, AssetInfo>;
    /** `getAssetInfo`가 던지는 심볼(DB 장애). */
    failingAssets: Set<string>;
    /** `correctKrSymbolSuffix`의 교정표(입력 대문자 → 마스터 심볼). */
    krSuffix: Record<string, string>;
    failing: Set<string>;
    e2eFake: boolean;
    xToken: boolean;
    naverAi: boolean;
    priceAlertLaunched: boolean;
}

function freshWorld(): GoldenWorld {
    return {
        series: {},
        names: {},
        failing: new Set(),
        assets: {},
        failingAssets: new Set(),
        krSuffix: {},
        e2eFake: false,
        xToken: true,
        naverAi: false,
        priceAlertLaunched: true,
    };
}

export const world: GoldenWorld = freshWorld();

export function resetWorld(): void {
    Object.assign(world, freshWorld());
}

/** 자산 하나를 합성 시장에 올린다 — `getAssetInfo`와 공급자 시세·봉이 같은 종목을 보게 한다. */
export function listAsset(asset: AssetInfo, series: SeriesSpec): void {
    world.assets[asset.symbol] = asset;
    const providerSymbol = asset.fmpSymbol ?? asset.symbol;
    world.series[providerSymbol] = series;
    world.names[providerSymbol] = asset.name;
}

/**
 * 합성 시장의 마감 세션 종가(EOD 게시 여유까지 지난 세션만) — 일봉 이력 로더들이 돌려주는 모양.
 * 공급자 심볼이 `failing`이면 던진다.
 */
function historyCloses(
    providerSymbol: string,
    session: MarketSessionSpec,
    now: Date
): MarketDailyClose[] | null {
    if (world.failing.has(providerSymbol))
        throw new Error(`synthetic history failure for ${providerSymbol}`);
    const spec = world.series[providerSymbol];
    if (spec === undefined) return null;
    const lastClosed = lastClosedSessionDate(session, now);
    return closedDailyCloses(spec, session, now).filter(
        close => close.date <= lastClosed
    );
}

function priceStatsCloses(
    providerSymbol: string,
    session: MarketSessionSpec,
    now: Date,
    source: 'five_year_cache' | 'full_history'
) {
    const closes = historyCloses(providerSymbol, session, now);
    if (closes === null || closes.length === 0) return null;
    return {
        closes,
        source,
        sessionInProgress:
            session.kind === 'scheduled' && sessionOpenNow(session, now),
    };
}

const dbError = (): Error =>
    Object.assign(new Error('relation lookup failed: secret params'), {
        name: 'DrizzleQueryError',
    });

/** 리포지토리 목 — 생성자는 늘 같은 메서드 묶음을 돌려준다. */
const repo = <T extends object>(methods: T) => ({
    methods,
    ctor: vi.fn(function () {
        return methods;
    }),
});

export const repos = {
    news: repo({ listCardsBySymbol: vi.fn(async () => [] as unknown[]) }),
    marketNews: repo({
        listCardsByCategory: vi.fn(async () => [] as unknown[]),
    }),
    portfolio: repo({
        findByUser: vi.fn(async () => [] as unknown[]),
        findByUserAndSymbol: vi.fn(async () => null as unknown),
    }),
    watchlist: repo({ findByUser: vi.fn(async () => [] as unknown[]) }),
    priceAlert: repo({ listForSubscriber: vi.fn(async () => [] as unknown[]) }),
    analysisHistory: repo({
        findRecentForPrompt: vi.fn(async () => [] as unknown[]),
    }),
    seoSnapshot: repo({ findBySymbol: vi.fn(async () => [] as unknown[]) }),
    earningsReports: repo({
        listReportedEps: vi.fn(async () => [] as unknown[]),
    }),
    secFilings: repo({
        findCikBySymbol: vi.fn(async () => null as number | null),
    }),
};

type GetYahooMacroQuotes =
    typeof import('@/shared/api/yahoo/yahooMacroSource').getYahooMacroQuotes;
type GetYahooMacroDailyCloses =
    typeof import('@/shared/api/yahoo/yahooMacroSource').getYahooMacroDailyCloses;
type FetchAlotMatter =
    typeof import('@/shared/api/dart/dartClient').fetchAlotMatter;
type FetchCompanyConceptJson =
    typeof import('@/shared/api/sec/secClient').fetchCompanyConceptJson;
type FetchIndexConstituents =
    typeof import('@/shared/api/wikipedia/indexConstituents').fetchIndexConstituents;
type ReadCompanyFiling =
    typeof import('@/entities/company-filings/server/getCompanyFilings').readCompanyFiling;
type GetKrValuation =
    typeof import('@/entities/kr-valuation/server/getKrValuation').getKrValuation;

export const fakes = {
    getAssetInfo: vi.fn(async (symbol: string): Promise<AssetInfo | null> => {
        if (world.failingAssets.has(symbol)) throw dbError();
        return world.assets[symbol] ?? null;
    }),
    isCryptoSymbolStatic: vi.fn(
        async (symbol: string) =>
            world.assets[symbol]?.marketProfile === 'crypto'
    ),
    correctKrSymbolSuffix: vi.fn(
        async (symbol: string) =>
            world.krSuffix[symbol.toUpperCase()] ?? symbol.toUpperCase()
    ),
    searchTicker: vi.fn(async (_query: string) => [] as unknown[]),
    findKrListedShares: vi.fn(async () => null as number | null),
    resolveKrxTickTable: vi.fn(async () => undefined as unknown),
    getCachedMarketDataProvider: vi.fn((session: MarketSessionSpec) =>
        syntheticProvider(world, session)
    ),
    getCachedExtendedBarsProvider: vi.fn(() => null),
    isE2E: vi.fn(() => world.e2eFake),
    isE2EFakeMode: vi.fn(() => world.e2eFake),
    xBearerToken: vi.fn(() => (world.xToken ? 'golden-x-token' : null)),
    naverAiCredentials: vi.fn(() =>
        world.naverAi ? { id: 'golden-naver-id', secret: 'golden-naver' } : null
    ),
    searchNaverNews: vi.fn(async () => [] as unknown[]),
    searchNaverWeb: vi.fn(async () => [] as unknown[]),
    fetchNaverInvestorTrend: vi.fn(async () => [] as unknown[]),
    getYahooMacroQuotes: vi.fn<GetYahooMacroQuotes>(async () => new Map()),
    getYahooMacroDailyCloses: vi.fn<GetYahooMacroDailyCloses>(async () => null),
    getYahooOwnershipShares: vi.fn(async () => null as unknown),
    getYahooDividendData: vi.fn(async () => null as unknown),
    getFmpDividendHistory: vi.fn(async () => [] as unknown[]),
    getFundamentalDataProvider: vi.fn((_symbol: string) => ({}) as unknown),
    getFinancialStatementsProvider: vi.fn((_symbol: string) => ({
        getIncomeStatements: async () => [] as unknown[],
    })),
    getFmpGradesConsensus: vi.fn(async () => null as unknown),
    isDartEnabled: vi.fn(() => true),
    fetchAlotMatter: vi.fn<FetchAlotMatter>(async () => null),
    fetchCompanyConceptJson: vi.fn<FetchCompanyConceptJson>(async () => null),
    fetchIndexConstituents: vi.fn<FetchIndexConstituents>(async () => []),
    safeFetch: vi.fn(async (_url: string) => new Response('', { status: 404 })),
    getOrSetCache: vi.fn(
        async (_key: string, _ttl: unknown, fetcher: () => Promise<unknown>) =>
            fetcher()
    ),
    setCacheValue: vi.fn(async () => undefined),
    getRedisClient: vi.fn(() => null),
    getRedisReaderWriter: vi.fn(() => null),
    createRedisFlag: vi.fn(() => ({
        isSet: async () => false,
        mark: async () => undefined,
        clear: async () => undefined,
    })),
    getDatabaseClient: vi.fn(() => ({ db: { golden: 'db' } })),
    ensureSymbolNewsFresh: vi.fn(async (_symbol: string) => undefined),
    findMarketEventsForPrompt: vi.fn(async () => [] as unknown[]),
    submitNewsAnalysisAction: vi.fn(
        async () => ({ status: 'error' }) as unknown
    ),
    peekMarketNewsDigestStatic: vi.fn(async () => null as unknown),
    listEarningsDates: vi.fn(async () => undefined as unknown),
    getNextEarningsSchedule: vi.fn(async () => null as unknown),
    listReportedEarningsDates: vi.fn(async () => [] as string[]),
    getCongressTradesResilient: vi.fn(async () => ({
        trades: [] as unknown[],
        degraded: false,
    })),
    loadIndexMonthEnds: vi.fn(async () => null as unknown),
    getXPosts: vi.fn(async () => ({ status: 'no_known_account' }) as unknown),
    fetchOptionsSnapshot: vi.fn(async () => null as unknown),
    hasOptionsMarket: vi.fn(async () => false),
    submitOptionsAnalysisAction: vi.fn(
        async () => ({ status: 'error' }) as unknown
    ),
    getAnalystViews: vi.fn(async () => null as unknown),
    loadDailyCloseHistory: vi.fn(
        async (input: {
            symbol: string;
            session: MarketSessionSpec;
            now: Date;
        }) => historyCloses(input.symbol, input.session, input.now) ?? []
    ),
    loadPriceStatsCloses: vi.fn(
        async (input: {
            symbol: string;
            fmpSymbol?: string;
            session: MarketSessionSpec;
            now: Date;
        }) =>
            priceStatsCloses(
                input.fmpSymbol ?? input.symbol,
                input.session,
                input.now,
                'five_year_cache'
            )
    ),
    loadIndexPriceStatsCloses: vi.fn(
        async (index: AgentHistoryIndex, now: Date) => {
            // 지연 import: 이 파일은 `vi.mock` 팩토리 안에서 적재되므로, 목 대상 모듈을 끌어올 수 있는 의존은 호출 시점에
            // 읽는다(적재 시점에 읽으면 팩토리가 이 파일을 기다리며 교착한다).
            const [{ INDEX_SOURCES }, { sessionSpecFor }] = await Promise.all([
                import('@/entities/index-history/lib/indexSources'),
                import('@/shared/api/market/sessionSpecFor'),
            ]);
            const source = INDEX_SOURCES[index];
            return priceStatsCloses(
                source.symbol,
                sessionSpecFor(source.profile),
                now,
                'full_history'
            );
        }
    ),
    listCompanyFilings: vi.fn(
        async () => ({ status: 'no_sec_filer' }) as unknown
    ),
    readCompanyFiling: vi.fn<ReadCompanyFiling>(async () => ({
        status: 'no_sec_filer',
    })),
    loadGuideCatalog: vi.fn(async () => null as unknown),
    getMarketFearGreedStatic: vi.fn(async () => null as unknown),
    getMarketFearGreedKrStatic: vi.fn(async () => null as unknown),
    peekBriefingStatic: vi.fn(async () => null as unknown),
    getMarketSummaryStatic: vi.fn(async () => null as unknown),
    getSectorSignalsStatic: vi.fn(async () => null as unknown),
    getEconomicCalendarRange: vi.fn(async () => [] as unknown[]),
    getEconomySnapshotStatic: vi.fn(async () => null as unknown),
    getCalendarFromDb: vi.fn(async () => [] as unknown[]),
    getKrIndicatorCards: vi.fn(async () => [] as unknown[]),
    peekMacroBriefingStatic: vi.fn(async () => null as unknown),
    getFreshTreasuryRates: vi.fn(async () => null as unknown),
    isPriceAlertLaunched: vi.fn(() => world.priceAlertLaunched),
    readEmailReportSecret: vi.fn(
        () => 'golden-email-report-secret-0123456789abcdef' as string | null
    ),
    getInvestorFlowsScorecard: vi.fn(
        async () => ({ degraded: true }) as unknown
    ),
    getHolderLookup: vi.fn(async () => null as unknown),
    getKrDartCorp: vi.fn(async () => null as unknown),
    getKrValuation: vi.fn<GetKrValuation>(async () => {
        throw new Error('golden: getKrValuation is not arranged for this case');
    }),
    runOverallAnalysisAction: vi.fn(
        async () => ({ status: 'error' }) as unknown
    ),
    peekAnalysisCache: vi.fn(async () => null as unknown),
    peekOverallAnalysisCache: vi.fn(async () => null as unknown),
    runAnalysis: vi.fn(async () => ({ status: 'error' }) as unknown),
};

/**
 * 목할 모듈 → 그 모듈에서 바꿔 끼우는 이름. `toolGolden.test.ts`가 경로마다 `importOriginal` 위에 이 값을 덮는다
 * (TESTING.md#TE-3 — 나머지 export는 실물로 남는다).
 */
export const MOCKED_MODULES: Readonly<Record<string, Record<string, unknown>>> =
    {
        '@y0ngha/siglens-core': {
            peekAnalysisCache: fakes.peekAnalysisCache,
            peekOverallAnalysisCache: fakes.peekOverallAnalysisCache,
            runAnalysis: fakes.runAnalysis,
        },
        '@/shared/api/market/getCachedMarketDataProvider': {
            getCachedMarketDataProvider: fakes.getCachedMarketDataProvider,
            getCachedExtendedBarsProvider: fakes.getCachedExtendedBarsProvider,
        },
        '@/shared/api/e2eEnv': {
            isE2E: fakes.isE2E,
            isE2EFakeMode: fakes.isE2EFakeMode,
        },
        '@/shared/api/naver/naverSearch': {
            naverAiCredentials: fakes.naverAiCredentials,
            searchNaverNews: fakes.searchNaverNews,
            searchNaverWeb: fakes.searchNaverWeb,
        },
        '@/shared/api/naver/naverInvestorTrend': {
            fetchNaverInvestorTrend: fakes.fetchNaverInvestorTrend,
        },
        '@/shared/api/x/xClient': { xBearerToken: fakes.xBearerToken },
        '@/shared/api/yahoo/yahooMacroSource': {
            getYahooMacroQuotes: fakes.getYahooMacroQuotes,
            getYahooMacroDailyCloses: fakes.getYahooMacroDailyCloses,
        },
        '@/shared/api/yahoo/yahooOwnershipSource': {
            getYahooOwnershipShares: fakes.getYahooOwnershipShares,
        },
        '@/shared/api/yahoo/yahooDividendSource': {
            getYahooDividendData: fakes.getYahooDividendData,
        },
        '@/shared/api/fmp/dividendsClient': {
            getFmpDividendHistory: fakes.getFmpDividendHistory,
        },
        '@/shared/api/fmp/getFundamentalDataProvider': {
            getFundamentalDataProvider: fakes.getFundamentalDataProvider,
        },
        '@/shared/api/fmp/getFinancialStatementsProvider': {
            getFinancialStatementsProvider:
                fakes.getFinancialStatementsProvider,
        },
        '@/shared/api/fmp/getFmpGradesConsensus': {
            getFmpGradesConsensus: fakes.getFmpGradesConsensus,
        },
        '@/shared/api/dart/dartClient': {
            isDartEnabled: fakes.isDartEnabled,
            fetchAlotMatter: fakes.fetchAlotMatter,
        },
        '@/shared/api/sec/secClient': {
            fetchCompanyConceptJson: fakes.fetchCompanyConceptJson,
        },
        '@/shared/api/wikipedia/indexConstituents': {
            fetchIndexConstituents: fakes.fetchIndexConstituents,
        },
        '@/shared/api/web/safeFetch': { safeFetch: fakes.safeFetch },
        '@/shared/cache/getOrSetCache': {
            getOrSetCache: fakes.getOrSetCache,
            setCacheValue: fakes.setCacheValue,
        },
        '@/shared/cache/redisClient': {
            getRedisClient: fakes.getRedisClient,
            getRedisReaderWriter: fakes.getRedisReaderWriter,
        },
        '@/shared/cache/createRedisFlag': {
            createRedisFlag: fakes.createRedisFlag,
        },
        '@/shared/db/client': { getDatabaseClient: fakes.getDatabaseClient },
        '@/entities/ticker/server/getAssetInfo': {
            getAssetInfo: fakes.getAssetInfo,
        },
        '@/entities/ticker/server/isCryptoSymbolStatic': {
            isCryptoSymbolStatic: fakes.isCryptoSymbolStatic,
        },
        '@/entities/ticker/server/koreanNameStore': {
            correctKrSymbolSuffix: fakes.correctKrSymbolSuffix,
        },
        '@/entities/ticker/server/searchTicker': {
            searchTicker: fakes.searchTicker,
        },
        '@/entities/ticker/api': {
            findKrListedShares: fakes.findKrListedShares,
        },
        '@/entities/ticker/server/resolveKrxTickTable': {
            resolveKrxTickTable: fakes.resolveKrxTickTable,
        },
        '@/entities/news-article/server/ensureSymbolNewsFresh': {
            ensureSymbolNewsFresh: fakes.ensureSymbolNewsFresh,
        },
        '@/entities/news-article/api': {
            DrizzleNewsRepository: repos.news.ctor,
        },
        '@/entities/news-article/marketEventsRepository': {
            findMarketEventsForPrompt: fakes.findMarketEventsForPrompt,
        },
        '@/entities/news-article/actions/submitNewsAnalysisAction': {
            submitNewsAnalysisAction: fakes.submitNewsAnalysisAction,
        },
        '@/entities/market-news/api/marketNewsRepository': {
            DrizzleMarketNewsRepository: repos.marketNews.ctor,
        },
        '@/entities/market-news/api/marketNewsDigestStaticCache': {
            peekMarketNewsDigestStatic: fakes.peekMarketNewsDigestStatic,
        },
        '@/entities/earnings-report/api': {
            listEarningsDates: fakes.listEarningsDates,
            getNextEarningsSchedule: fakes.getNextEarningsSchedule,
            listReportedEarningsDates: fakes.listReportedEarningsDates,
        },
        '@/entities/earnings-report/server/earningsReportsRepository': {
            DrizzleEarningsReportsRepository: repos.earningsReports.ctor,
        },
        '@/entities/congress-trades/server/getCongressTradesResilient': {
            getCongressTradesResilient: fakes.getCongressTradesResilient,
        },
        '@/entities/index-history/server/loadIndexMonthEnds': {
            loadIndexMonthEnds: fakes.loadIndexMonthEnds,
        },
        '@/entities/x-posts/server/getXPosts': { getXPosts: fakes.getXPosts },
        '@/entities/options-chain/server/optionsDataCache': {
            fetchOptionsSnapshot: fakes.fetchOptionsSnapshot,
            hasOptionsMarket: fakes.hasOptionsMarket,
        },
        '@/entities/options-chain/actions/optionsActions': {
            submitOptionsAnalysisAction: fakes.submitOptionsAnalysisAction,
        },
        '@/entities/analyst-views/server/getAnalystViews': {
            getAnalystViews: fakes.getAnalystViews,
        },
        '@/entities/bars/server/loadDailyCloseHistory': {
            loadDailyCloseHistory: fakes.loadDailyCloseHistory,
        },
        '@/entities/bars/server/loadPriceStatsCloses': {
            loadPriceStatsCloses: fakes.loadPriceStatsCloses,
            loadIndexPriceStatsCloses: fakes.loadIndexPriceStatsCloses,
        },
        '@/entities/company-filings/server/getCompanyFilings': {
            listCompanyFilings: fakes.listCompanyFilings,
            readCompanyFiling: fakes.readCompanyFiling,
        },
        '@/entities/guide/api': { loadGuideCatalog: fakes.loadGuideCatalog },
        '@/entities/market-fear-greed/api/marketFearGreedStaticCache': {
            getMarketFearGreedStatic: fakes.getMarketFearGreedStatic,
        },
        '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache': {
            getMarketFearGreedKrStatic: fakes.getMarketFearGreedKrStatic,
        },
        '@/entities/market-summary/api/briefingStaticCache': {
            peekBriefingStatic: fakes.peekBriefingStatic,
        },
        '@/entities/market-summary/api/marketSummaryStaticCache': {
            getMarketSummaryStatic: fakes.getMarketSummaryStatic,
        },
        '@/entities/sector-signal/api/sectorSignalsStaticCache': {
            getSectorSignalsStatic: fakes.getSectorSignalsStatic,
        },
        '@/entities/economy/api/economicCalendarRangeCache': {
            getEconomicCalendarRange: fakes.getEconomicCalendarRange,
        },
        '@/entities/economy/api/economySnapshotStaticCache': {
            getEconomySnapshotStatic: fakes.getEconomySnapshotStatic,
        },
        '@/entities/economy/api/getCalendarFromDb': {
            getCalendarFromDb: fakes.getCalendarFromDb,
        },
        '@/entities/economy/api/getKrIndicatorCards': {
            getKrIndicatorCards: fakes.getKrIndicatorCards,
        },
        '@/entities/economy/api/macroBriefingStaticCache': {
            peekMacroBriefingStatic: fakes.peekMacroBriefingStatic,
        },
        '@/entities/economy/api/treasuryRatesCache': {
            getFreshTreasuryRates: fakes.getFreshTreasuryRates,
        },
        '@/entities/portfolio/api': {
            DrizzlePortfolioRepository: repos.portfolio.ctor,
        },
        '@/entities/watchlist/api': {
            DrizzleWatchlistRepository: repos.watchlist.ctor,
        },
        '@/entities/mail-alert/api': {
            DrizzlePriceAlertRepository: repos.priceAlert.ctor,
        },
        '@/entities/mail-alert/lib/priceAlertConstants': {
            isPriceAlertLaunched: fakes.isPriceAlertLaunched,
        },
        '@/entities/email-report/emailReportSecret': {
            readEmailReportSecret: fakes.readEmailReportSecret,
        },
        '@/entities/investor-flows/server/getInvestorFlowsScorecard': {
            getInvestorFlowsScorecard: fakes.getInvestorFlowsScorecard,
        },
        '@/entities/investor-flows/server/getHolderLookup': {
            getHolderLookup: fakes.getHolderLookup,
        },
        '@/entities/investor-flows/server/getKrDartCorp': {
            getKrDartCorp: fakes.getKrDartCorp,
        },
        '@/entities/investor-flows/api/investorFlowsFilingsRepository': {
            DrizzleSecFilingsRepository: repos.secFilings.ctor,
        },
        '@/entities/kr-valuation/server/getKrValuation': {
            getKrValuation: fakes.getKrValuation,
        },
        '@/entities/analysis/analysisHistoryRepository': {
            DrizzleAnalysisHistoryRepository: repos.analysisHistory.ctor,
        },
        '@/entities/analysis/actions/runOverallAnalysisAction': {
            runOverallAnalysisAction: fakes.runOverallAnalysisAction,
        },
        '@/entities/seo-snapshot/api': {
            DrizzleSeoSnapshotRepository: repos.seoSnapshot.ctor,
        },
    };
