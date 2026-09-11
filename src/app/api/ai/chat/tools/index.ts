import 'server-only';
import type {
    ExecuteTool,
    ModelId,
    ToolExecutionContext,
} from '@y0ngha/siglens-core';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isE2E } from '@/shared/api/e2eEnv';
import { truncateToolResult } from './truncate';
import { searchTickerTool } from './searchTicker';
import { getQuoteTool } from './getQuote';
import { getBarsIndicatorsTool } from './getBarsIndicators';
import { getCachedAnalysisTool } from './getCachedAnalysis';
import { getNewsTool } from './getNews';
import { getOptionsSummaryTool } from './getOptionsSummary';
import { getMyPortfolioTool } from './getMyPortfolio';

export interface ToolRuntime {
    /** Analysis model for cache keys/fresh runs — pilot: fixed to the agent model. */
    analysisModel: ModelId;
}
export type ToolExecutor = (
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    runtime: ToolRuntime
) => Promise<unknown>;

const EXECUTORS: Record<string, ToolExecutor> = {
    search_ticker: searchTickerTool,
    get_quote: getQuoteTool,
    get_bars_indicators: getBarsIndicatorsTool,
    get_cached_analysis: getCachedAnalysisTool,
    get_news: getNewsTool,
    get_options_summary: getOptionsSummaryTool,
    get_my_portfolio: getMyPortfolioTool,
    // Task 13 adds: run_fresh_analysis, web_search
};

/** Tools this process can execute now. `web_search` needs a Brave key and is off under E2E. */
export function availableToolNames(): Set<string> {
    const names = new Set(Object.keys(EXECUTORS));
    if (isE2E() || !process.env.BRAVE_SEARCH_API_KEY)
        names.delete('web_search');
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
    return async (name, args, ctx) => {
        const executor = EXECUTORS[name];
        if (!executor) return { error: 'unknown_tool' };
        if (ctx.signal.aborted) return { error: 'aborted' };
        if (symbolsIn(args).some(s => !isAdmissibleSymbolShape(s)))
            return { error: 'invalid_symbol' };
        try {
            return truncateToolResult(await executor(args, ctx, runtime));
        } catch (error) {
            logToolError(name, error);
            return { error: 'tool_failed' };
        }
    };
}
