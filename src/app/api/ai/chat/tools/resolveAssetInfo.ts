import 'server-only';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import type { AssetInfo } from '@/shared/lib/types';

/**
 * Wraps `getAssetInfo` so a DB/FMP failure degrades to `null` — no
 * `fmpSymbol`, company name falls back to the symbol — instead of failing
 * the whole tool call.
 *
 * `getBarsIndicators.ts`, `getQuote.ts` and `runFreshAnalysis.ts` all run
 * this alongside a sibling call inside `Promise.all`/`Promise.allSettled`;
 * an unhandled rejection here would otherwise sink that sibling too (or, for
 * `Promise.all`, fail the whole lookup) over a lookup whose only output is a
 * cosmetic company name / a symbol-mapping hint.
 *
 * Logs only the error's `name` — same privacy rule as `logToolError` in
 * `tools/index.ts` (a `DrizzleQueryError`'s `.message`/`.stack` can embed
 * bound params, e.g. the caller's raw symbol string).
 */
export async function resolveAssetInfoOrNull(
    symbol: string,
    toolName: string
): Promise<AssetInfo | null> {
    try {
        return await getAssetInfo(symbol);
    } catch (error) {
        const errorName = error instanceof Error ? error.name : 'unknown';
        console.warn(
            '[AgentTool]',
            toolName,
            'getAssetInfo failed, degrading',
            { errorName }
        );
        return null;
    }
}

/** Fields that tell the model which instrument a symbol actually resolved to. */
export interface ResolvedInstrumentFields {
    /** Name of the instrument whose data is in this result (e.g. `ProShares VIX Mid-Term Futures ETF`). */
    resolvedName?: string;
    /** Provider-side symbol when it differs from the requested one (e.g. `^VIX`, `BRK-B`). */
    resolvedSymbol?: string;
}

/**
 * Surfaces the resolved instrument's name (and provider symbol, when it differs) in a
 * tool result, so a symbol that maps to a different instrument is visible to the model
 * instead of being presented under the requested ticker. Before the exact-match fix in
 * `findExactUsMatch`, `VIX` resolved to the VIXM ETF and the tool output said only
 * `symbol: "VIX"` — the model reported the ETF's close as the index level.
 *
 * Empty when the lookup degraded (`null`) — absence means "unknown", not "same".
 */
export function resolvedInstrumentFields(
    asset: AssetInfo | null
): ResolvedInstrumentFields {
    if (asset === null) return {};
    return {
        ...(asset.name ? { resolvedName: asset.name } : {}),
        ...(asset.fmpSymbol && asset.fmpSymbol !== asset.symbol
            ? { resolvedSymbol: asset.fmpSymbol }
            : {}),
    };
}
