import 'server-only';
import type {
    ExecuteTool,
    ModelId,
    ToolExecutionContext,
} from '@y0ngha/siglens-core';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { naverAiCredentials } from '@/entities/news-article/api';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    AGGREGATE_RESULT_MAX_CHARS,
    BARS_RESULT_MAX_CHARS,
    CACHED_ANALYSIS_MAX_CHARS,
    CACHED_ANALYSIS_TURN_BUDGET_CHARS,
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
import { safeErrorFields } from './logToolDegrade';
import { isGuestSubject } from '../guestSubject';
import { ensureSymbolNewsFresh } from './ensureSymbolDataFresh';

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
}
/**
 * `createToolExecutor`에 넘기는 입력. `ensureSymbolData`는 턴 메모가 필요해
 * **실행부가 직접 만들므로** 호출자가 넘기지 않는다.
 */
export type ToolRuntimeInput = Omit<ToolRuntime, 'ensureSymbolData'>;

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
};

/**
 * Tools this process can execute now. `web_search` needs a Brave key and is
 * off under E2E — except when `AGENT_REAL_PROVIDER=1` opts a local dev server
 * back into the real provider (see `entities/llm-provider/api/agent`): that
 * server exists to exercise real round-trips, and a search tool that silently
 * vanishes there is exactly the kind of gap that only shows up in production.
 * CI never sets it, so the e2e suite keeps the deterministic tool set.
 */
export function availableToolNames(): Set<string> {
    const names = new Set(Object.keys(EXECUTORS));
    const e2eFake = isE2E() && process.env.AGENT_REAL_PROVIDER !== '1';
    const keyed =
        Boolean(process.env.BRAVE_SEARCH_API_KEY) ||
        naverAiCredentials() !== null;
    if (e2eFake || !keyed) names.delete('web_search');
    return names;
}

/**
 * A `DrizzleQueryError`'s `.message` (and often `.stack`) embeds the failed
 * statement's bound params — for these tools that can include the caller's
 * `userId` or a symbol string built from raw model tool-call args — and a
 * thrown error's `message` becomes part of a tool-result message that is
 * stored in the conversation and rendered in the UI. Never forward it.
 * Mirrors `entities/chat-conversation/lib/logActionError.ts`: only the
 * error's `name` and (if present) the driver's short SQLSTATE-ish
 * `cause.code` are safe, non-sensitive diagnostics.
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
export function createToolExecutor(runtime: ToolRuntimeInput): ExecuteTool {
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
        const symbol = raw.toUpperCase();
        const existing = refreshed.get(symbol);
        if (existing !== undefined) return existing;
        const pending = ensureSymbolNewsFresh(symbol).then(
            () => undefined,
            (error: unknown) => {
                console.error('[ensureSymbolData]', symbol, error);
            }
        );
        refreshed.set(symbol, pending);
        return pending;
    };
    const toolRuntime: ToolRuntime = { ...runtime, ensureSymbolData };

    // One executor per turn (`stream/route.ts`), so this closure is the turn's
    // allowance for oversized stored analyses — see `CACHED_ANALYSIS_MAX_CHARS`.
    let cachedAnalysisCharsLeft = CACHED_ANALYSIS_TURN_BUDGET_CHARS;
    // `run_fresh_analysis` returns the same analysis shape as
    // `get_cached_analysis` (see `runFreshAnalysis.ts`), so a just-run
    // analysis must not be cut harder than a stored one.
    const isAnalysis = (name: string): boolean =>
        name === 'get_cached_analysis' || name === 'run_fresh_analysis';
    const ceilingFor = (name: string): number => {
        // `get_bars_indicators` already fits itself against
        // `BARS_RESULT_MAX_CHARS` (`getBarsIndicators.ts`'s
        // `fitBarsToBudget`) — routing it through the shared 4,000 default
        // here would re-cut an already-fit 6,000-char result down to 4,000
        // and collapse it into a front-cut preview blob.
        if (name === 'get_bars_indicators') return BARS_RESULT_MAX_CHARS;
        if (name === 'get_market_overview' || name === 'get_economy')
            return AGGREGATE_RESULT_MAX_CHARS;
        if (!isAnalysis(name)) return TOOL_RESULT_MAX_CHARS;
        return Math.max(
            TOOL_RESULT_MAX_CHARS,
            Math.min(CACHED_ANALYSIS_MAX_CHARS, cachedAnalysisCharsLeft)
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
            const result = truncateToolResult(
                await executor(args, ctx, toolRuntime),
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
