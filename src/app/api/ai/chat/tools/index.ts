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
import { isGuestSubject } from '../guestSubject';

export interface ToolRuntime {
    /** Analysis model for cache keys/fresh runs — pilot: fixed to the agent model. */
    analysisModel: ModelId;
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
    const errorName = error instanceof Error ? error.name : 'unknown';
    const rawCode = (error as { cause?: { code?: unknown } } | null)?.cause
        ?.code;
    const code = typeof rawCode === 'string' ? rawCode : undefined;
    console.error('[AgentTool]', name, { errorName, code });
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
export function createToolExecutor(runtime: ToolRuntime): ExecuteTool {
    // One executor per turn (`stream/route.ts`), so this closure is the turn's
    // allowance for oversized stored analyses — see `CACHED_ANALYSIS_MAX_CHARS`.
    let cachedAnalysisCharsLeft = CACHED_ANALYSIS_TURN_BUDGET_CHARS;
    // `run_fresh_analysis` returns the same analysis shape as
    // `get_cached_analysis` (see `runFreshAnalysis.ts`), so a just-run
    // analysis must not be cut harder than a stored one.
    const isAnalysis = (name: string): boolean =>
        name === 'get_cached_analysis' || name === 'run_fresh_analysis';
    const ceilingFor = (name: string): number => {
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
                await executor(args, ctx, runtime),
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
