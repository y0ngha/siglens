/**
 * 에이전트 도구 출력 골든.
 *
 * 모든 사례(`goldenCases.ts`)를 두 실행기 설정으로 돌린다 — 에이전트(`AGENT_RESULT_CAPS`, 기본 옵션, `onChart`)와
 * 공개 API(`executePublicTool`과 같은 옵션: `refreshSymbolData: false`, `PUBLIC_API_RESULT_CAPS`,
 * `allowUnofficialSources: false`, `substituteFreshTechnicalForOverall: false`). 둘 다 `createToolExecutor`를 거치므로
 * 한국 종목 접미사 교정, 교정 기록, 결과 절단까지 포함된다. 결과는 `JSON.stringify` 문자열 그대로 `golden/*.json`과
 * 비교한다(깊은 비교가 아니다). 차트를 내는 도구는 `onChart`로 나온 블록도 함께 고정한다.
 *
 * 골든 갱신 규칙:
 * - 도구 파일을 옮기는 PR(실행기를 다른 레이어로 옮기는 리팩터)은 **골든을 다시 만들지 않는다**. 그 PR에서 이 파일은
 *   import·`vi.mock` 경로 줄만 바뀌고 `golden/*.json`은 한 바이트도 바뀌지 않아야 한다 — 그것이 "출력이 그대로"라는 증명이다.
 * - 도구 출력을 의도해서 바꾸는 그 밖의 PR은 `GOLDEN_UPDATE=1 yarn test src/app/api/ai/chat/tools/__tests__/golden` 뒤
 *   `yarn format`으로 다시 만들고, 바뀐 JSON의 차이(어느 필드가 왜)를 PR 본문에 설명한다.
 * - 파일이 없으면 실패한다 — CI에서 자동으로 쓰지 않는다.
 * - 공유 픽스처를 재사용한다: `@/entities/analysis-outcome/__tests__/fixtures/storedAnalyses.json`(저장된 기술 분석),
 *   `../fixtures/secConcepts`·`../fixtures/sinceEarlier`, `@/widgets/investor-flows/__tests__/fixtures/flowsFixtures`,
 *   `@/__tests__/fixtures/guideFixtures`. 이 파일들을 바꾸면 골든도 바뀔 수 있다 — 그때도 위 규칙대로 다시 만들고 설명한다.
 *
 * 목한 경로(도구 이동 PR이 옮기지 않는 모듈만 — 도구 폴더 `src/app/api/ai/chat/**`와 그 이동 목적지는 하나도 없다; 메타
 * 테스트가 지킨다): `@y0ngha/siglens-core`(분석 캐시 peek·`runAnalysis`만), `next-intl/server`, `@/shared/api/**`(시장
 * 공급자·e2e 판정·네이버·X·Yahoo·FMP·DART·SEC·위키백과·safeFetch), `@/shared/cache/{getOrSetCache,redisClient,createRedisFlag}`,
 * `@/shared/db/client`, 엔티티 `server/`·`api`·`actions` 로더(목록은 `boundary.ts`의 `MOCKED_MODULES`). 전역 `fetch`는
 * 사례마다 기본 거부 스텁이고, 공급자를 흉내 내는 사례만 덮어쓴다.
 */
const { mockedModule } = vi.hoisted(() => ({
    mockedModule: async (
        path: string,
        importOriginal: () => Promise<unknown>
    ): Promise<Record<string, unknown>> => {
        const { MOCKED_MODULES } = await import('./boundary');
        const original = (await importOriginal()) as Record<string, unknown>;
        return { ...original, ...MOCKED_MODULES[path] };
    },
}));
vi.mock('@y0ngha/siglens-core', importOriginal =>
    mockedModule('@y0ngha/siglens-core', importOriginal)
);
vi.mock('next-intl/server', async () => {
    const { nextIntlServerStub } =
        await import('@/shared/test-utils/catalogTranslator');
    return nextIntlServerStub();
});
vi.mock('@/shared/api/market/getCachedMarketDataProvider', importOriginal =>
    mockedModule(
        '@/shared/api/market/getCachedMarketDataProvider',
        importOriginal
    )
);
vi.mock('@/shared/api/e2eEnv', importOriginal =>
    mockedModule('@/shared/api/e2eEnv', importOriginal)
);
vi.mock('@/shared/api/naver/naverSearch', importOriginal =>
    mockedModule('@/shared/api/naver/naverSearch', importOriginal)
);
vi.mock('@/shared/api/naver/naverInvestorTrend', importOriginal =>
    mockedModule('@/shared/api/naver/naverInvestorTrend', importOriginal)
);
vi.mock('@/shared/api/x/xClient', importOriginal =>
    mockedModule('@/shared/api/x/xClient', importOriginal)
);
vi.mock('@/shared/api/yahoo/yahooMacroSource', importOriginal =>
    mockedModule('@/shared/api/yahoo/yahooMacroSource', importOriginal)
);
vi.mock('@/shared/api/yahoo/yahooOwnershipSource', importOriginal =>
    mockedModule('@/shared/api/yahoo/yahooOwnershipSource', importOriginal)
);
vi.mock('@/shared/api/yahoo/yahooDividendSource', importOriginal =>
    mockedModule('@/shared/api/yahoo/yahooDividendSource', importOriginal)
);
vi.mock('@/shared/api/fmp/dividendsClient', importOriginal =>
    mockedModule('@/shared/api/fmp/dividendsClient', importOriginal)
);
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', importOriginal =>
    mockedModule('@/shared/api/fmp/getFundamentalDataProvider', importOriginal)
);
vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', importOriginal =>
    mockedModule(
        '@/shared/api/fmp/getFinancialStatementsProvider',
        importOriginal
    )
);
vi.mock('@/shared/api/fmp/getFmpGradesConsensus', importOriginal =>
    mockedModule('@/shared/api/fmp/getFmpGradesConsensus', importOriginal)
);
vi.mock('@/shared/api/dart/dartClient', importOriginal =>
    mockedModule('@/shared/api/dart/dartClient', importOriginal)
);
vi.mock('@/shared/api/sec/secClient', importOriginal =>
    mockedModule('@/shared/api/sec/secClient', importOriginal)
);
vi.mock('@/shared/api/wikipedia/indexConstituents', importOriginal =>
    mockedModule('@/shared/api/wikipedia/indexConstituents', importOriginal)
);
vi.mock('@/shared/api/web/safeFetch', importOriginal =>
    mockedModule('@/shared/api/web/safeFetch', importOriginal)
);
vi.mock('@/shared/cache/getOrSetCache', importOriginal =>
    mockedModule('@/shared/cache/getOrSetCache', importOriginal)
);
vi.mock('@/shared/cache/redisClient', importOriginal =>
    mockedModule('@/shared/cache/redisClient', importOriginal)
);
vi.mock('@/shared/cache/createRedisFlag', importOriginal =>
    mockedModule('@/shared/cache/createRedisFlag', importOriginal)
);
vi.mock('@/shared/db/client', importOriginal =>
    mockedModule('@/shared/db/client', importOriginal)
);
vi.mock('@/entities/ticker/server/getAssetInfo', importOriginal =>
    mockedModule('@/entities/ticker/server/getAssetInfo', importOriginal)
);
vi.mock('@/entities/ticker/server/isCryptoSymbolStatic', importOriginal =>
    mockedModule(
        '@/entities/ticker/server/isCryptoSymbolStatic',
        importOriginal
    )
);
vi.mock('@/entities/ticker/server/koreanNameStore', importOriginal =>
    mockedModule('@/entities/ticker/server/koreanNameStore', importOriginal)
);
vi.mock('@/entities/ticker/server/searchTicker', importOriginal =>
    mockedModule('@/entities/ticker/server/searchTicker', importOriginal)
);
vi.mock('@/entities/ticker/api', importOriginal =>
    mockedModule('@/entities/ticker/api', importOriginal)
);
vi.mock('@/entities/ticker/server/resolveKrxTickTable', importOriginal =>
    mockedModule('@/entities/ticker/server/resolveKrxTickTable', importOriginal)
);
vi.mock(
    '@/entities/news-article/server/ensureSymbolNewsFresh',
    importOriginal =>
        mockedModule(
            '@/entities/news-article/server/ensureSymbolNewsFresh',
            importOriginal
        )
);
vi.mock('@/entities/news-article/api', importOriginal =>
    mockedModule('@/entities/news-article/api', importOriginal)
);
vi.mock('@/entities/news-article/marketEventsRepository', importOriginal =>
    mockedModule(
        '@/entities/news-article/marketEventsRepository',
        importOriginal
    )
);
vi.mock(
    '@/entities/news-article/actions/submitNewsAnalysisAction',
    importOriginal =>
        mockedModule(
            '@/entities/news-article/actions/submitNewsAnalysisAction',
            importOriginal
        )
);
vi.mock('@/entities/market-news/api/marketNewsRepository', importOriginal =>
    mockedModule(
        '@/entities/market-news/api/marketNewsRepository',
        importOriginal
    )
);
vi.mock(
    '@/entities/market-news/api/marketNewsDigestStaticCache',
    importOriginal =>
        mockedModule(
            '@/entities/market-news/api/marketNewsDigestStaticCache',
            importOriginal
        )
);
vi.mock('@/entities/earnings-report/api', importOriginal =>
    mockedModule('@/entities/earnings-report/api', importOriginal)
);
vi.mock(
    '@/entities/earnings-report/server/earningsReportsRepository',
    importOriginal =>
        mockedModule(
            '@/entities/earnings-report/server/earningsReportsRepository',
            importOriginal
        )
);
vi.mock(
    '@/entities/congress-trades/server/getCongressTradesResilient',
    importOriginal =>
        mockedModule(
            '@/entities/congress-trades/server/getCongressTradesResilient',
            importOriginal
        )
);
vi.mock('@/entities/index-history/server/loadIndexMonthEnds', importOriginal =>
    mockedModule(
        '@/entities/index-history/server/loadIndexMonthEnds',
        importOriginal
    )
);
vi.mock('@/entities/x-posts/server/getXPosts', importOriginal =>
    mockedModule('@/entities/x-posts/server/getXPosts', importOriginal)
);
vi.mock('@/entities/options-chain/server/optionsDataCache', importOriginal =>
    mockedModule(
        '@/entities/options-chain/server/optionsDataCache',
        importOriginal
    )
);
vi.mock('@/entities/options-chain/actions/optionsActions', importOriginal =>
    mockedModule(
        '@/entities/options-chain/actions/optionsActions',
        importOriginal
    )
);
vi.mock('@/entities/analyst-views/server/getAnalystViews', importOriginal =>
    mockedModule(
        '@/entities/analyst-views/server/getAnalystViews',
        importOriginal
    )
);
vi.mock('@/entities/bars/server/loadDailyCloseHistory', importOriginal =>
    mockedModule('@/entities/bars/server/loadDailyCloseHistory', importOriginal)
);
vi.mock('@/entities/bars/server/loadPriceStatsCloses', importOriginal =>
    mockedModule('@/entities/bars/server/loadPriceStatsCloses', importOriginal)
);
vi.mock('@/entities/company-filings/server/getCompanyFilings', importOriginal =>
    mockedModule(
        '@/entities/company-filings/server/getCompanyFilings',
        importOriginal
    )
);
vi.mock('@/entities/guide/api', importOriginal =>
    mockedModule('@/entities/guide/api', importOriginal)
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedStaticCache',
    importOriginal =>
        mockedModule(
            '@/entities/market-fear-greed/api/marketFearGreedStaticCache',
            importOriginal
        )
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    importOriginal =>
        mockedModule(
            '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
            importOriginal
        )
);
vi.mock('@/entities/market-summary/api/briefingStaticCache', importOriginal =>
    mockedModule(
        '@/entities/market-summary/api/briefingStaticCache',
        importOriginal
    )
);
vi.mock(
    '@/entities/market-summary/api/marketSummaryStaticCache',
    importOriginal =>
        mockedModule(
            '@/entities/market-summary/api/marketSummaryStaticCache',
            importOriginal
        )
);
vi.mock(
    '@/entities/sector-signal/api/sectorSignalsStaticCache',
    importOriginal =>
        mockedModule(
            '@/entities/sector-signal/api/sectorSignalsStaticCache',
            importOriginal
        )
);
vi.mock('@/entities/economy/api/economicCalendarRangeCache', importOriginal =>
    mockedModule(
        '@/entities/economy/api/economicCalendarRangeCache',
        importOriginal
    )
);
vi.mock('@/entities/economy/api/economySnapshotStaticCache', importOriginal =>
    mockedModule(
        '@/entities/economy/api/economySnapshotStaticCache',
        importOriginal
    )
);
vi.mock('@/entities/economy/api/getCalendarFromDb', importOriginal =>
    mockedModule('@/entities/economy/api/getCalendarFromDb', importOriginal)
);
vi.mock('@/entities/economy/api/getKrIndicatorCards', importOriginal =>
    mockedModule('@/entities/economy/api/getKrIndicatorCards', importOriginal)
);
vi.mock('@/entities/economy/api/macroBriefingStaticCache', importOriginal =>
    mockedModule(
        '@/entities/economy/api/macroBriefingStaticCache',
        importOriginal
    )
);
vi.mock('@/entities/economy/api/treasuryRatesCache', importOriginal =>
    mockedModule('@/entities/economy/api/treasuryRatesCache', importOriginal)
);
vi.mock('@/entities/portfolio/api', importOriginal =>
    mockedModule('@/entities/portfolio/api', importOriginal)
);
vi.mock('@/entities/watchlist/api', importOriginal =>
    mockedModule('@/entities/watchlist/api', importOriginal)
);
vi.mock('@/entities/mail-alert/api', importOriginal =>
    mockedModule('@/entities/mail-alert/api', importOriginal)
);
vi.mock('@/entities/mail-alert/lib/priceAlertConstants', importOriginal =>
    mockedModule(
        '@/entities/mail-alert/lib/priceAlertConstants',
        importOriginal
    )
);
vi.mock('@/entities/email-report/emailReportSecret', importOriginal =>
    mockedModule('@/entities/email-report/emailReportSecret', importOriginal)
);
vi.mock(
    '@/entities/investor-flows/server/getInvestorFlowsScorecard',
    importOriginal =>
        mockedModule(
            '@/entities/investor-flows/server/getInvestorFlowsScorecard',
            importOriginal
        )
);
vi.mock('@/entities/investor-flows/server/getHolderLookup', importOriginal =>
    mockedModule(
        '@/entities/investor-flows/server/getHolderLookup',
        importOriginal
    )
);
vi.mock('@/entities/investor-flows/server/getKrDartCorp', importOriginal =>
    mockedModule(
        '@/entities/investor-flows/server/getKrDartCorp',
        importOriginal
    )
);
vi.mock(
    '@/entities/investor-flows/api/investorFlowsFilingsRepository',
    importOriginal =>
        mockedModule(
            '@/entities/investor-flows/api/investorFlowsFilingsRepository',
            importOriginal
        )
);
vi.mock('@/entities/kr-valuation/server/getKrValuation', importOriginal =>
    mockedModule(
        '@/entities/kr-valuation/server/getKrValuation',
        importOriginal
    )
);
vi.mock('@/entities/analysis/analysisHistoryRepository', importOriginal =>
    mockedModule(
        '@/entities/analysis/analysisHistoryRepository',
        importOriginal
    )
);
vi.mock(
    '@/entities/analysis/actions/runOverallAnalysisAction',
    importOriginal =>
        mockedModule(
            '@/entities/analysis/actions/runOverallAnalysisAction',
            importOriginal
        )
);
vi.mock('@/entities/seo-snapshot/api', importOriginal =>
    mockedModule('@/entities/seo-snapshot/api', importOriginal)
);

import type { ToolExecutionContext } from '@y0ngha/siglens-core';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    availableToolNames,
    createToolExecutor,
    type ChartToolCall,
} from '@/app/api/ai/chat/tools/chatTools';
import { __resetFreshSemaphoreForTests } from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { __resetWebSearchCacheForTests } from '@/app/api/ai/chat/tools/webSearchCache';
import { __resetBarsMemoryForTests } from '@/entities/bars/server/barsDataCache';
import type { ChatBlock } from '@/entities/chat-conversation/types';
import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { AGENT_TOOL_SET } from '@/features/agent-tools/spec/agentToolSet';
import { PUBLIC_API_RESULT_CAPS } from '@/shared/config/publicApi';
import { fakes, MOCKED_MODULES, resetWorld, world } from './boundary';
import { CALLERS, type GoldenCase } from './goldenCase';
import { GOLDEN_CASES } from './goldenCases';

/** 실제 core 계산(500~1,300봉 지표·신호·공포탐욕)을 사례마다 두 번 돌린다 — 부하 걸린 CI에서 기본 5초를 넘는다. */
const HEAVY_COMPUTE_TIMEOUT_MS = 60_000;
/** 도구마다 최소 사례 수. */
const MIN_CASES_PER_TOOL = 3;
const GOLDEN_DIR = __dirname;
const UPDATE = process.env.GOLDEN_UPDATE === '1';
/** 사례 id의 고정 UUID — `propose_price_alert`의 `proposalId`가 매번 같게. */
const FIXED_UUID = '00000000-0000-4000-8000-00000000a1e7';

interface ConfigRun {
    result: unknown;
    charts: { call: ChartToolCall; block: ChatBlock | null }[];
    refreshedSymbols: string[];
}

interface GoldenRecord {
    tool: string;
    case: string;
    now: string;
    caller: string;
    locale: string;
    args: Record<string, unknown>;
    agent: ConfigRun;
    publicApi: ConfigRun;
}

/**
 * 도구 이동 PR이 옮기는 출발지와 목적지. 여기에 목을 걸면 이동 PR에서 이 파일의 본문(목 경로가 아닌 줄)이 바뀌거나, 옮긴 모듈의
 * 실제 동작이 골든에서 빠진다.
 */
const MOVED_PATH_PREFIXES = [
    '@/app/api/ai/chat',
    '@/features/agent-tools',
] as const;
const MOVED_DESTINATION_MODULES = [
    '@/shared/api/guestSubject',
    '@/entities/ticker/server/resolveAssetInfo',
    '@/entities/ticker/server/krSymbolCorrection',
    '@/entities/ticker/lib/freshness',
    '@/entities/investor-flows/server/krInvestorTrend',
    '@/entities/kr-valuation/lib/krListedBasis',
    '@/entities/earnings-report/lib/secQuarters',
    '@/entities/earnings-report/server/loadSecQuarters',
    '@/entities/index-history/server/indexMembership',
] as const;
const isMovedPath = (modulePath: string): boolean =>
    MOVED_PATH_PREFIXES.some(prefix => modulePath.startsWith(prefix)) ||
    MOVED_DESTINATION_MODULES.some(target => modulePath === target);

const caseId = (c: GoldenCase): string => `${c.tool}.${c.name}`;
const goldenPath = (c: GoldenCase): string =>
    path.join(GOLDEN_DIR, `${caseId(c)}.json`);

function contextFor(c: GoldenCase, agent: boolean): ToolExecutionContext {
    const claim = agent ? c.webSearchClaim : undefined;
    return {
        ...CALLERS[c.caller ?? 'member'],
        locale: c.locale ?? 'ko',
        signal: new AbortController().signal,
        ...(claim === undefined
            ? {}
            : {
                  claimWebSearchUnit: async () =>
                      claim === 'ok'
                          ? { ok: true as const }
                          : {
                                ok: false as const,
                                refusal: {
                                    error: 'quota' as const,
                                    scope: 'global_day' as const,
                                },
                            },
              }),
    };
}

/** 실행기 하나가 들고 다니는 프로세스 메모(봉 LRU, 웹 검색 캐시, 새 분석 슬롯)를 비운다. */
function resetProcessMemos(): void {
    __resetBarsMemoryForTests();
    __resetWebSearchCacheForTests();
    __resetFreshSemaphoreForTests();
}

async function runAgent(c: GoldenCase): Promise<ConfigRun> {
    // 차트 블록은 실행기가 `onChart`로 넘긴다 — 호출 기록을 그대로 읽는다(누적 배열 없이).
    const onChart =
        vi.fn<
            (call: ChartToolCall, pending: Promise<ChatBlock | null>) => void
        >();
    const execute = createToolExecutor(
        {
            analysisModel: AGENT_MODEL,
            ...(c.earlierAnalyses === undefined
                ? {}
                : { earlierAnalyses: c.earlierAnalyses }),
        },
        { onChart }
    );
    const result = await execute(
        c.tool,
        structuredClone(c.args),
        contextFor(c, true)
    );
    const charts = await Promise.all(
        onChart.mock.calls.map(async ([call, pending]) => ({
            call,
            block: await pending,
        }))
    );
    return { result, charts, refreshedSymbols: refreshedSymbols() };
}

async function runPublicApi(c: GoldenCase): Promise<ConfigRun> {
    const execute = createToolExecutor(
        { analysisModel: AGENT_MODEL },
        {
            refreshSymbolData: false,
            resultCaps: PUBLIC_API_RESULT_CAPS,
            allowUnofficialSources: false,
            substituteFreshTechnicalForOverall: false,
        }
    );
    const result = await execute(
        c.tool,
        structuredClone(c.args),
        contextFor(c, false)
    );
    return { result, charts: [], refreshedSymbols: refreshedSymbols() };
}

function refreshedSymbols(): string[] {
    const symbols = fakes.ensureSymbolNewsFresh.mock.calls.map(
        ([symbol]) => symbol
    );
    fakes.ensureSymbolNewsFresh.mockClear();
    return symbols;
}

async function runCase(c: GoldenCase): Promise<GoldenRecord> {
    vi.setSystemTime(new Date(c.now));
    c.arrange?.();
    const agent = await runAgent(c);
    resetProcessMemos();
    const publicApi = await runPublicApi(c);
    return {
        tool: c.tool,
        case: c.name,
        now: c.now,
        caller: c.caller ?? 'member',
        locale: c.locale ?? 'ko',
        args: c.args,
        agent,
        publicApi,
    };
}

function readGolden(c: GoldenCase): unknown {
    const file = goldenPath(c);
    if (!existsSync(file))
        throw new Error(
            `missing golden ${path.basename(file)} — a PR that intentionally changes tool output regenerates with GOLDEN_UPDATE=1 (then yarn format) and explains the JSON diff in its body; a PR that only moves tool files never regenerates`
        );
    return JSON.parse(readFileSync(file, 'utf8'));
}

describe('에이전트 도구 실행기 골든', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetWorld();
        resetProcessMemos();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'golden-brave-key');
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'info').mockImplementation(() => undefined);
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID);
        // 기본 거부: 스텁하지 않은 실제 네트워크 호출은 조용히 새지 않고 사례를 깨뜨린다. 공급자를 흉내 내는 사례만 덮어쓴다.
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: unknown) => {
                throw new Error(`golden: unstubbed fetch ${String(input)}`);
            })
        );
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    GOLDEN_CASES.forEach(c => {
        it(
            `${caseId(c)}: 두 실행기 설정의 출력이 골든과 바이트 단위로 같다`,
            { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
            async () => {
                const record = await runCase(c);
                const serialized = JSON.stringify(record);
                if (UPDATE)
                    writeFileSync(
                        goldenPath(c),
                        `${JSON.stringify(record, null, 2)}\n`
                    );
                const golden = readGolden(c);
                expect(JSON.parse(serialized)).toEqual(golden);
                expect(serialized).toBe(JSON.stringify(golden));
            }
        );
    });
});

describe('골든 커버리지', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetWorld();
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'golden-brave-key');
    });

    const casesPerTool = (): Map<string, number> =>
        new Map(
            Object.entries(Object.groupBy(GOLDEN_CASES, c => c.tool)).map(
                ([tool, list]) => [tool, list?.length ?? 0]
            )
        );

    const undercovered = (names: Iterable<string>): string[] => {
        const counts = casesPerTool();
        return [...names].filter(
            name => (counts.get(name) ?? 0) < MIN_CASES_PER_TOOL
        );
    };

    it('키가 모두 있고 가격대 알림이 공개된 에이전트의 모든 도구에 사례가 3개 이상 있다', () => {
        const names = availableToolNames();
        expect(names.has('web_search')).toBe(true);
        expect(names.has('get_x_posts')).toBe(true);
        expect(undercovered(names)).toEqual([]);
    });

    it('E2E fake 모드의 모든 도구에 사례가 3개 이상 있다', () => {
        world.e2eFake = true;
        const names = availableToolNames();
        expect(names.has('get_price_stats')).toBe(false);
        expect(undercovered(names)).toEqual([]);
    });

    it('AGENT_TOOL_SET의 모든 도구에 사례가 3개 이상 있다', () => {
        expect(undercovered(AGENT_TOOL_SET.tools.map(t => t.name))).toEqual([]);
    });

    it('모든 사례의 도구를 실행기가 안다', () => {
        const names = availableToolNames();
        expect(GOLDEN_CASES.filter(c => !names.has(c.tool))).toEqual([]);
    });

    it('사례 id가 겹치지 않는다', () => {
        const ids = GOLDEN_CASES.map(caseId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('모든 골든 파일이 사례에 속한다(고아 파일 없음)', () => {
        const ids = new Set(GOLDEN_CASES.map(caseId));
        const files = readdirSync(GOLDEN_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => file.slice(0, -'.json'.length));
        expect(files.filter(id => !ids.has(id))).toEqual([]);
        expect(files.length).toBe(ids.size);
    });

    it('도구 이동 PR이 옮기지 않는 모듈만, 경계 목록 그대로 목한다', () => {
        const source = readFileSync(__filename, 'utf8');
        const mocked = [...source.matchAll(/^vi\.mock\(\s*'([^']+)'/gm)].map(
            match => match[1] ?? ''
        );
        expect(mocked.filter(isMovedPath)).toEqual([]);
        expect(mocked.toSorted()).toEqual(
            [...Object.keys(MOCKED_MODULES), 'next-intl/server'].toSorted()
        );
    });
});
