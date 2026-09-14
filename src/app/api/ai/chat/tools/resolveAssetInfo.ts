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
