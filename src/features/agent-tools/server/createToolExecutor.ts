import 'server-only';
import type { ExecuteTool } from '@y0ngha/siglens-core';
import type { ChatBlock } from '@/entities/chat-conversation/types';
import { isPriceAlertLaunched } from '@/entities/mail-alert/lib/priceAlertConstants';
import { ensureSymbolNewsFresh } from '@/entities/news-article/server/ensureSymbolNewsFresh';
import { correctKrSymbolArgs } from '@/entities/ticker/server/krSymbolCorrection';
import { MEMBER_ONLY_TOOLS } from '@/features/agent-tools/lib/memberOnlyTools';
import {
    AGGREGATE_RESULT_MAX_CHARS,
    ECONOMY_RESULT_MAX_CHARS,
    INVESTOR_FLOWS_RESULT_MAX_CHARS,
    GUIDE_RESULT_MAX_CHARS,
    MACRO_QUOTES_RESULT_MAX_CHARS,
    X_POSTS_RESULT_MAX_CHARS,
    COMPANY_FILINGS_RESULT_MAX_CHARS,
    INDEX_HISTORY_RESULT_MAX_CHARS,
    SWING_HISTORY_RESULT_MAX_CHARS,
    PRICE_STATS_RESULT_MAX_CHARS,
    ANALYST_VIEWS_RESULT_MAX_CHARS,
    BARS_ANNOTATE_HEADROOM_CHARS,
    WEB_SEARCH_RESULT_MAX_CHARS,
    WATCHLIST_RESULT_MAX_CHARS,
    BARS_RESULT_MAX_CHARS,
    CACHED_ANALYSIS_MAX_CHARS,
    CACHED_ANALYSIS_TURN_BUDGET_CHARS,
    FUNDAMENTALS_RESULT_MAX_CHARS,
    NEWS_RESULT_MAX_CHARS,
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/features/agent-tools/lib/truncate';
import type {
    ChartToolCall,
    ToolExecutor,
    ToolResultCaps,
    ToolRuntime,
} from '@/features/agent-tools/model';
import {
    GET_MY_WATCHLIST_TOOL,
    PROPOSE_PRICE_ALERT_TOOL,
} from '@/features/agent-tools/spec/watchlistAlertTools';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { naverAiCredentials } from '@/shared/api/naver/naverSearch';
import { xBearerToken } from '@/shared/api/x/xClient';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { isGuestSubject } from '@/shared/lib/guestSubject';
import { safeErrorFields } from '@/shared/lib/logToolDegrade';
import { runFreshAnalysisTool } from './freshAnalysis/runFreshAnalysis';
import { getAnalystViewsTool } from './tools/getAnalystViews';
import { getBarsIndicatorsTool } from './tools/getBarsIndicators';
import { getCachedAnalysisTool } from './tools/getCachedAnalysis';
import { getCompanyFilingsTool } from './tools/getCompanyFilings';
import { getCongressTradesTool } from './tools/getCongressTrades';
import { getEconomyTool } from './tools/getEconomy';
import { getFundamentalsTool } from './tools/getFundamentals';
import { getGuideTool } from './tools/getGuide';
import { getIndexHistoryStatsTool } from './tools/getIndexHistoryStats';
import { getInvestorFlowsTool } from './tools/getInvestorFlows';
import { getMacroQuotesTool } from './tools/getMacroQuotes';
import { getMarketOverviewTool } from './tools/getMarketOverview';
import { getMyPortfolioTool } from './tools/getMyPortfolio';
import { getMyWatchlistTool } from './tools/getMyWatchlist';
import { getNewsTool } from './tools/getNews';
import { getOptionsSummaryTool } from './tools/getOptionsSummary';
import { getPriceStatsTool } from './tools/getPriceStats';
import { getQuoteTool } from './tools/getQuote';
import { getSwingHistoryTool } from './tools/getSwingHistory';
import { getThemeSnapshotTool } from './tools/getThemeSnapshot';
import { getXPostsTool } from './tools/getXPosts';
import { proposePriceAlertTool } from './tools/proposePriceAlert';
import { searchTickerTool } from './tools/searchTicker';
import { showChartTool } from './tools/showChart';
import { webSearchTool } from './tools/webSearch';

/**
 * `createToolExecutor`에 넘기는 입력. `ensureSymbolData`는 턴 메모가 필요해
 * **실행부가 직접 만들고**, `allowUnofficialSources`는 실행기 옵션으로만 정하므로 호출자가 넘기지 않는다.
 */
export type ToolRuntimeInput = Omit<
    ToolRuntime,
    | 'ensureSymbolData'
    | 'allowUnofficialSources'
    | 'substituteFreshTechnicalForOverall'
    | 'emitChart'
    | 'barsResultMaxChars'
>;

/** The agent's caps: they protect an LLM context window across a multi-step turn. */
export const AGENT_RESULT_CAPS: ToolResultCaps = {
    standard: TOOL_RESULT_MAX_CHARS,
    bars: BARS_RESULT_MAX_CHARS,
    aggregate: AGGREGATE_RESULT_MAX_CHARS,
    economy: ECONOMY_RESULT_MAX_CHARS,
    investorFlows: INVESTOR_FLOWS_RESULT_MAX_CHARS,
    guide: GUIDE_RESULT_MAX_CHARS,
    macroQuotes: MACRO_QUOTES_RESULT_MAX_CHARS,
    companyFilings: COMPANY_FILINGS_RESULT_MAX_CHARS,
    xPosts: X_POSTS_RESULT_MAX_CHARS,
    indexHistory: INDEX_HISTORY_RESULT_MAX_CHARS,
    swingHistory: SWING_HISTORY_RESULT_MAX_CHARS,
    priceStats: PRICE_STATS_RESULT_MAX_CHARS,
    analystViews: ANALYST_VIEWS_RESULT_MAX_CHARS,
    fundamentals: FUNDAMENTALS_RESULT_MAX_CHARS,
    news: NEWS_RESULT_MAX_CHARS,
    webSearch: WEB_SEARCH_RESULT_MAX_CHARS,
    watchlist: WATCHLIST_RESULT_MAX_CHARS,
    cachedAnalysis: CACHED_ANALYSIS_MAX_CHARS,
    cachedAnalysisBudget: CACHED_ANALYSIS_TURN_BUDGET_CHARS,
};

export interface ToolExecutorOptions {
    /**
     * `false` turns `ensureSymbolData` into a no-op: no FMP ingest and no server-key LLM news-card
     * analysis (`ensureSymbolNewsFresh`); tools return only what is already stored. Default `true`
     * (the agent). The public API passes `false` — its callers must never spend server money.
     */
    refreshSymbolData?: boolean;
    /** Defaults to {@link AGENT_RESULT_CAPS}. */
    resultCaps?: ToolResultCaps;
    /**
     * `false` keeps tools off unofficial external sources (see `ToolRuntime.allowUnofficialSources`).
     * Default `true` (the agent). The public API passes `false` — it redistributes tool output to third parties.
     */
    allowUnofficialSources?: boolean;
    /**
     * `false` keeps `get_cached_analysis` from answering an `overall` request with a fresh technical analysis
     * (see `ToolRuntime.substituteFreshTechnicalForOverall`). Default `true` (the agent). The public API passes `false`.
     */
    substituteFreshTechnicalForOverall?: boolean;
    /**
     * 도구가 차트 블록을 냈을 때 부른다(`ToolRuntime.emitChart`). 생략하면 블록을 만들지 않는다 — 실행기는
     * `emitChart`가 없으면 봉 조회도 하지 않는다. 에이전트 스트림만 넘긴다.
     */
    onChart?: (call: ChartToolCall, pending: Promise<ChatBlock | null>) => void;
}

const EXECUTORS: Record<string, ToolExecutor> = {
    search_ticker: searchTickerTool,
    get_quote: getQuoteTool,
    get_bars_indicators: getBarsIndicatorsTool,
    get_cached_analysis: getCachedAnalysisTool,
    get_news: getNewsTool,
    get_options_summary: getOptionsSummaryTool,
    get_my_portfolio: getMyPortfolioTool,
    [GET_MY_WATCHLIST_TOOL]: getMyWatchlistTool,
    [PROPOSE_PRICE_ALERT_TOOL]: proposePriceAlertTool,
    run_fresh_analysis: runFreshAnalysisTool,
    web_search: webSearchTool,
    get_fundamentals: getFundamentalsTool,
    get_market_overview: getMarketOverviewTool,
    get_economy: getEconomyTool,
    get_congress_trades: getCongressTradesTool,
    get_investor_flows: getInvestorFlowsTool,
    get_guide: getGuideTool,
    get_analyst_views: getAnalystViewsTool,
    get_macro_quotes: getMacroQuotesTool,
    get_company_filings: getCompanyFilingsTool,
    get_x_posts: getXPostsTool,
    get_theme_snapshot: getThemeSnapshotTool,
    get_index_history_stats: getIndexHistoryStatsTool,
    get_swing_history: getSwingHistoryTool,
    get_price_stats: getPriceStatsTool,
    show_chart: showChartTool,
};

/**
 * Tools this process can execute now. `web_search` needs a Brave key and is
 * off under E2E — except when `AGENT_REAL_PROVIDER=1` opts a local dev server
 * back into the real provider (see `entities/llm-provider/api/agent/getAgentProvider`): that
 * server exists to exercise real round-trips, and a search tool that silently
 * vanishes there is exactly the kind of gap that only shows up in production.
 * CI never sets it, so the e2e suite keeps the deterministic tool set.
 *
 * `get_x_posts` follows the same rule with `X_BEARER_TOKEN`: X bills per post read, so without a key the tool
 * is not offered to the model at all (core drops its routing row and guest line with it).
 */
export function availableToolNames(): Set<string> {
    const names = new Set(Object.keys(EXECUTORS));
    const e2eFake = isE2EFakeMode();
    const keyed =
        Boolean(process.env.BRAVE_SEARCH_API_KEY) ||
        naverAiCredentials() !== null;
    if (e2eFake || !keyed) names.delete('web_search');
    if (e2eFake || xBearerToken() === null) names.delete('get_x_posts');
    // 지수 이력은 E2E fake 모드에서 읽지 않는다(엔티티가 던진다) — 늘 실패할 도구를 내놓지 않는다.
    if (e2eFake) names.delete('get_index_history_stats');
    // 긴 일봉 이력도 같다(엔티티가 E2E fake 모드에서 던진다).
    if (e2eFake) names.delete('get_swing_history');
    // 가격 통계도 같다 — 종가 이력을 같은 엔티티 경로로 읽고, fake 공급자의 봉은 3개뿐이다.
    if (e2eFake) names.delete('get_price_stats');
    // 가격대 알림 제안은 공개 전에는 모델에 내놓지 않는다 — 카드의 만들기 버튼이 전부 `unavailable`일 때 제안만 나가면 안 된다.
    if (!isPriceAlertLaunched()) names.delete(PROPOSE_PRICE_ALERT_TOOL);
    return names;
}

/**
 * A `DrizzleQueryError`'s `.message` (and often `.stack`) embeds the failed
 * statement's bound params — for these tools that can include the caller's
 * `userId` or a symbol string built from raw model tool-call args — and a
 * thrown error's `message` becomes part of a tool-result message that is
 * stored in the conversation and rendered in the UI. Never forward it.
 * Same principle as `shared/lib/logActionError.ts`: only the error's `name`
 * and the driver's short SQLSTATE-ish `cause.code` are safe, non-sensitive
 * diagnostics. (`logActionError` additionally falls back to a top-level
 * `code`; this helper reads `cause.code` only.)
 */
function logToolError(name: string, error: unknown): void {
    console.error('[AgentTool]', name, safeErrorFields(error));
}

function symbolsIn(args: Record<string, unknown>): string[] {
    const list: unknown[] = [];
    if (args.symbol !== undefined) list.push(args.symbol);
    if (Array.isArray(args.symbols)) list.push(...args.symbols);
    return list.filter((s): s is string => typeof s === 'string');
}

/**
 * Turns EXECUTORS into core's `ExecuteTool` contract: never throw, always
 * resolve to a JSON-serializable payload that has already been truncated.
 *
 * `ctx.signal.aborted` is checked defensively even though core's
 * `runAgentTurn` already refuses to invoke `executeTool` once the turn
 * signal is aborted (see `runAgentTurn.js` `executeOne`) — a second,
 * process-local gate costs one line and survives a future core change that
 * stops guaranteeing that invariant.
 */
export function createToolExecutor(
    runtime: ToolRuntimeInput,
    options: ToolExecutorOptions = {}
): ExecuteTool {
    const {
        refreshSymbolData = true,
        resultCaps = AGENT_RESULT_CAPS,
        allowUnofficialSources = true,
        substituteFreshTechnicalForOverall = true,
        onChart,
    } = options;
    /**
     * 턴당 심볼별 1회. 한 대화에서 같은 심볼로 여러 툴이 불리는 게 정상이고
     * (뉴스 → 분석), 그때마다 수급을 돌리면 Redis TTL에 기대더라도 왕복이 툴
     * 수만큼 늘어난다. Promise를 캐시하므로 같은 턴의 동시 호출도 하나로 접힌다.
     *
     * `.catch`로 **거절을 캐시에 남기지 않는다**. 남기면 한 번의 실패가 그 턴의
     * 해당 심볼 전체를 오염시켜, 이후 모든 툴이 같은 rejected promise를 다시
     * await한다. 호출부가 `ToolRuntime.ensureSymbolData`의 never-reject 계약에
     * 기대므로 그 계약을 여기서 지역적으로도 보장한다.
     */
    const refreshed = new Map<string, Promise<void>>();
    const ensureSymbolData = (raw: string): Promise<void> => {
        if (!refreshSymbolData) return Promise.resolve();
        const symbol = raw.toUpperCase();
        const existing = refreshed.get(symbol);
        if (existing !== undefined) return existing;
        const pending = ensureSymbolNewsFresh(symbol).then(
            () => undefined,
            (error: unknown) => {
                console.error(
                    '[ensureSymbolData]',
                    symbol,
                    redactDbErrorForLog(error)
                );
            }
        );
        refreshed.set(symbol, pending);
        return pending;
    };
    const toolRuntime: ToolRuntime = {
        ...runtime,
        ensureSymbolData,
        allowUnofficialSources,
        substituteFreshTechnicalForOverall,
        barsResultMaxChars: Math.max(
            1,
            resultCaps.bars - BARS_ANNOTATE_HEADROOM_CHARS
        ),
    };

    // One executor per turn (`stream/route.ts`), so this closure is the turn's
    // allowance for oversized stored analyses — see `CACHED_ANALYSIS_MAX_CHARS`.
    let cachedAnalysisCharsLeft = resultCaps.cachedAnalysisBudget;
    // `run_fresh_analysis` returns the same analysis shape as
    // `get_cached_analysis` (see `runFreshAnalysis.ts`), so a just-run
    // analysis must not be cut harder than a stored one.
    const isAnalysis = (name: string): boolean =>
        name === 'get_cached_analysis' || name === 'run_fresh_analysis';
    const ceilingFor = (name: string): number => {
        // `get_bars_indicators` already fits itself against this same cap
        // (`ToolRuntime.barsResultMaxChars`, set above from `resultCaps.bars`;
        // `getBarsIndicators.ts`'s `fitBarsToBudget`) — routing it through the
        // shared 4,000 default here would re-cut an already-fit result and
        // collapse it into a front-cut preview blob.
        if (name === 'get_bars_indicators') return resultCaps.bars;
        if (name === 'get_market_overview') return resultCaps.aggregate;
        if (name === 'get_economy') return resultCaps.economy;
        // `get_investor_flows`는 점수표 + 상위 보유 기관·내부자·Form 144·증자 공시 목록(`SUMMARY_MAX_*` 상한,
        // `entities/investor-flows/lib/summary/`)이라 종합 도구 상한(6,000자)도 넘는다 — 이미 상한 안으로 자른 결과를 더 작은 한도로
        // 다시 자르면 앞부분 미리보기 덩어리로 무너진다.
        if (name === 'get_investor_flows') return resultCaps.investorFlows;
        if (name === 'get_guide') return resultCaps.guide;
        if (name === 'get_macro_quotes') return resultCaps.macroQuotes;
        if (name === 'get_company_filings') return resultCaps.companyFilings;
        if (name === 'get_x_posts') return resultCaps.xPosts;
        if (name === 'get_index_history_stats') return resultCaps.indexHistory;
        if (name === 'get_swing_history') return resultCaps.swingHistory;
        if (name === 'get_price_stats') return resultCaps.priceStats;
        if (name === 'get_analyst_views') return resultCaps.analystViews;
        if (name === 'get_news') return resultCaps.news;
        if (name === 'get_fundamentals') return resultCaps.fundamentals;
        if (name === 'web_search') return resultCaps.webSearch;
        if (name === GET_MY_WATCHLIST_TOOL) return resultCaps.watchlist;
        if (!isAnalysis(name)) return resultCaps.standard;
        return Math.max(
            resultCaps.standard,
            Math.min(resultCaps.cachedAnalysis, cachedAnalysisCharsLeft)
        );
    };
    return async (name, args, ctx) => {
        const executor = EXECUTORS[name];
        if (!executor) return { error: 'unknown_tool' };
        if (ctx.signal.aborted) return { error: 'aborted' };
        if (MEMBER_ONLY_TOOLS.has(name) && isGuestSubject(ctx.userId))
            return { error: 'login_required' };
        if (symbolsIn(args).some(s => !isAdmissibleSymbolShape(s)))
            return { error: 'invalid_symbol' };
        try {
            // 한국 종목 접미사(.KS/.KQ)를 마스터로 교정한다 — 잘못된 접미사는 yahoo의 죽은
            // 리스팅으로 해석된다(`correctKrSymbolSuffix` JSDoc). 교정 기록은 잘리기 전에 싣는다.
            const corrected = await correctKrSymbolArgs(args, name);
            // 호출마다 런타임을 하나 더 만든다 — 차트 블록을 이 호출(core가 `tool_start`에 실은 이름·인자)에 묶는다.
            const callRuntime: ToolRuntime =
                onChart === undefined
                    ? toolRuntime
                    : {
                          ...toolRuntime,
                          emitChart: pending =>
                              onChart({ name, args }, pending),
                      };
            const result = truncateToolResult(
                corrected.annotate(
                    await executor(corrected.args, ctx, callRuntime)
                ),
                ceilingFor(name)
            );
            if (isAnalysis(name))
                cachedAnalysisCharsLeft -= JSON.stringify(result)?.length ?? 0;
            return result;
        } catch (error) {
            logToolError(name, error);
            return { error: 'tool_failed' };
        }
    };
}
