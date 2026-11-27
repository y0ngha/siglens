import 'server-only';
import type {
    ExecuteTool,
    ModelId,
    ToolExecutionContext,
} from '@y0ngha/siglens-core';
import type { ChatBlock } from '@/entities/chat-conversation/types';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { naverAiCredentials } from '@/shared/api/naver/naverSearch';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { xBearerToken } from '@/shared/api/x/xClient';
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
    ANALYST_VIEWS_RESULT_MAX_CHARS,
    BARS_ANNOTATE_HEADROOM_CHARS,
    BARS_RESULT_MAX_CHARS,
    CACHED_ANALYSIS_MAX_CHARS,
    CACHED_ANALYSIS_TURN_BUDGET_CHARS,
    FUNDAMENTALS_RESULT_MAX_CHARS,
    NEWS_RESULT_MAX_CHARS,
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from './truncate';
import { searchTickerTool } from './searchTicker';
import { getQuoteTool } from './getQuote';
import { getBarsIndicatorsTool } from './getBarsIndicators';
import { getCachedAnalysisTool } from './getCachedAnalysis';
import { getNewsTool } from './getNews';
import { getOptionsSummaryTool } from './getOptionsSummary';
import { getMyPortfolioTool } from './getMyPortfolio';
import { runFreshAnalysisTool } from './runFreshAnalysis';
import { webSearchTool } from './webSearch';
import { getFundamentalsTool } from './getFundamentals';
import { getMarketOverviewTool } from './getMarketOverview';
import { getEconomyTool } from './getEconomy';
import { getCongressTradesTool } from './getCongressTrades';
import { getInvestorFlowsTool } from './getInvestorFlows';
import { getGuideTool } from './getGuide';
import { getAnalystViewsTool } from './getAnalystViews';
import { getMacroQuotesTool } from './getMacroQuotes';
import { getCompanyFilingsTool } from './getCompanyFilings';
import { getXPostsTool } from './getXPosts';
import { getThemeSnapshotTool } from './getThemeSnapshot';
import { getIndexHistoryStatsTool } from './getIndexHistoryStats';
import { getSwingHistoryTool } from './getSwingHistory';
import { showChartTool } from './showChart';
import { safeErrorFields } from './logToolDegrade';
import { correctKrSymbolArgs } from './krSymbolCorrection';
import { isGuestSubject } from '../guestSubject';
import { ensureSymbolNewsFresh } from '@/entities/news-article/server/ensureSymbolNewsFresh';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

export interface ToolRuntime {
    /** Analysis model for cache keys/fresh runs — pilot: fixed to the agent model. */
    analysisModel: ModelId;
    /**
     * 심볼의 외부 데이터를 최신화한다(현재는 뉴스 적재).
     *
     * **툴이 직접 부른다** — 실행부가 일괄로 걸지 않는다. 기준은 "수급을 돌리면
     * **이번 호출의 답**이 달라지는가"인데, 그 판단은 툴 안에서만 가능하다.
     *
     * 현재 호출자는 `get_news`의 심볼 질의 하나뿐이다. `listCardsBySymbol`이
     * 미보강 행도 돌려주므로 방금 적재한 기사의 제목·발행일·링크가 그 턴에 바로
     * 보인다. 반대로 `run_fresh_analysis`는 부르지 않는다 — 분석 축은
     * `isEnrichedRow`가 미보강 행을 걸러내 방금 넣은 행이 한 건도 안 들어간다.
     * `get_cached_analysis`는 이미 생성된 결과를 peek할 뿐이라 아예 해당 없다.
     *
     * 호출 위치도 툴이 정한다. 값싼 거절(잘못된 인자, 슬롯 포화) **뒤에** 불러야
     * 그 거절이 FMP·DB 왕복을 지불하지 않는다.
     *
     * 턴당 심볼별 1회로 접히고, **절대 reject하지 않는다** — 수급 실패가 질문
     * 자체를 죽이면 안 된다.
     */
    ensureSymbolData: (symbol: string) => Promise<void>;
    /**
     * `false`면 도구는 비공식 외부 소스(공식 API·약관이 없는 엔드포인트, 현재는 네이버 증권 모바일 JSON)를 읽지 않는다.
     * 생략하면 허용(에이전트). 공개 API는 제3자 개발자에게 재배포하는 경로라 `false`다(`createToolExecutor` 옵션이 채운다).
     */
    allowUnofficialSources?: boolean;
    /**
     * `get_cached_analysis(tab: 'overall')`이 새 생성으로 이어질 결과(found:false·stale:true)일 때 같은 타임프레임의
     * 신선한 technical 분석으로 대체할지. 생략하면 대체한다(에이전트). 공개 API는 `tab`을 계약으로 받는 제3자 클라이언트라
     * 요청과 다른 탭을 돌려주면 안 되므로 `false`다(`createToolExecutor` 옵션이 채운다).
     */
    substituteFreshTechnicalForOverall?: boolean;
    /**
     * 이 호출의 결과와 함께 보여 줄 차트 블록을 넘긴다(기술 분석·봉 지표 도구). 블록은 모델에 가지 않는다 — 실행부가
     * `ToolExecutorOptions.onChart`로 스트림·저장에 넘긴다. 생략하면(공개 API·차트 없는 실행) 아무것도 하지 않는다.
     * 넘기는 promise는 절대 reject하지 않아야 한다(`loadAnalysisChartBlock`처럼 실패를 `null`로 접는다).
     */
    emitChart?: (pending: Promise<ChatBlock | null>) => void;
    /**
     * `get_bars_indicators`가 봉 수를 맞출 문자 수 상한. 실행기(`createToolExecutor`)가 자기 `resultCaps.bars`에서
     * `annotate`가 앞에 붙이는 몫(`BARS_ANNOTATE_HEADROOM_CHARS`)을 뺀 값으로 채운다 — 에이전트와 공개 API가 각자의 상한에
     * 맞춰 오래된 봉을 줄이고, 결과 전체가 `{ truncated, preview }`로 무너지지 않게 한다. 도구를 실행기 없이 직접 부르면
     * (테스트) 비어 있고, 그때는 에이전트 상한 `BARS_RESULT_MAX_CHARS`를 쓴다.
     */
    barsResultMaxChars?: number;
}
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

/** 차트 블록을 낸 도구 호출 — core가 `tool_start`에 싣는 것과 같은 이름·인자(교정 전). */
export interface ChartToolCall {
    name: string;
    args: Record<string, unknown>;
}

/** Result-size ceilings (chars) the executor applies per tool class. */
export interface ToolResultCaps {
    /** Default for tools without a class of their own. */
    standard: number;
    /** `get_bars_indicators` (the tool fits its bar count to this cap minus `BARS_ANNOTATE_HEADROOM_CHARS`, via `ToolRuntime.barsResultMaxChars`). */
    bars: number;
    /** `get_market_overview`. */
    aggregate: number;
    /** `get_economy` (indicators + an up-to-80-event calendar). */
    economy: number;
    /** `get_investor_flows` (scorecard + capped holder, insider, Form 144 and offering lists). */
    investorFlows: number;
    guide: number;
    /** `get_macro_quotes` (up to 8 instruments, each with changes and a 52-week range). */
    macroQuotes: number;
    /** `get_company_filings` (a 10-filing list, or one filing's text up to `AGENT_FILING_TEXT_MAX_CHARS`). */
    companyFilings: number;
    /** `get_x_posts` (up to 12 posts of up to 600 characters, plus the account rows). */
    xPosts: number;
    /** `get_index_history_stats` (a year-by-year table since 1951 for the S&P 500). */
    indexHistory: number;
    /** `get_swing_history` (decline and rally summaries, size bands and up to 20 episodes each). */
    swingHistory: number;
    /** `get_analyst_views` (up to 15 actions plus four estimate periods). */
    analystViews: number;
    /** `get_fundamentals` (every section filled plus the earnings tally). */
    fundamentals: number;
    /** `get_news` (up to 20 items with summaries plus the symbol price-move block; the tool fits itself under this). */
    news: number;
    /** One stored analysis (`get_cached_analysis` / `run_fresh_analysis`). */
    cachedAnalysis: number;
    /** Total analysis chars one executor instance may spend above `standard`. */
    cachedAnalysisBudget: number;
}

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
    analystViews: ANALYST_VIEWS_RESULT_MAX_CHARS,
    fundamentals: FUNDAMENTALS_RESULT_MAX_CHARS,
    news: NEWS_RESULT_MAX_CHARS,
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

export type ToolExecutor = (
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    runtime: ToolRuntime
) => Promise<unknown>;

/**
 * Tools a guest may not run: only their own holdings — there is no account to
 * hold any. Fresh analyses and web search are open to guests (SIGLENS sets no
 * count limit on analysis), bounded by core's per-turn caps instead.
 */
const MEMBER_ONLY_TOOLS: ReadonlySet<string> = new Set(['get_my_portfolio']);

const EXECUTORS: Record<string, ToolExecutor> = {
    search_ticker: searchTickerTool,
    get_quote: getQuoteTool,
    get_bars_indicators: getBarsIndicatorsTool,
    get_cached_analysis: getCachedAnalysisTool,
    get_news: getNewsTool,
    get_options_summary: getOptionsSummaryTool,
    get_my_portfolio: getMyPortfolioTool,
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
        if (name === 'get_analyst_views') return resultCaps.analystViews;
        if (name === 'get_news') return resultCaps.news;
        if (name === 'get_fundamentals') return resultCaps.fundamentals;
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
