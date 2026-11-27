import 'server-only';
import { getAssetInfo } from '@/entities/ticker/server/getAssetInfo';
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
 * `features/agent-tools/server/createToolExecutor.ts` (a `DrizzleQueryError`'s
 * `.message`/`.stack` can embed bound params, e.g. the caller's raw symbol
 * string).
 */
export async function resolveAssetInfoOrNull(
    symbol: string,
    toolName: string
): Promise<AssetInfo | null> {
    return (await resolveAssetLookup(symbol, toolName)).asset;
}

/** `resolveAssetInfoOrNull`의 결과에 "조회가 던졌는가"를 더한 것. */
export interface AssetLookup {
    asset: AssetInfo | null;
    /** `true`면 조회가 던져 `asset`이 `null`이다(일시 장애일 수 있다). `false`인 `null`은 조회가 성공해 모르는 심볼이라고 답한 것이다. */
    lookupFailed: boolean;
}

/**
 * `resolveAssetInfoOrNull`과 같은 조회·로그 규칙이되, 조회가 던진 `null`과 조회가 성공해 돌려준 `null`(모르는 심볼)을 구분한다.
 * 모르는 심볼의 "이력 없음"을 잠시 기억해도 되는 쪽은 뒤쪽뿐이다.
 */
export async function resolveAssetLookup(
    symbol: string,
    toolName: string
): Promise<AssetLookup> {
    try {
        return { asset: await getAssetInfo(symbol), lookupFailed: false };
    } catch (error) {
        const errorName = error instanceof Error ? error.name : 'unknown';
        console.warn(
            '[AgentTool]',
            toolName,
            'getAssetInfo failed, degrading',
            { errorName }
        );
        return { asset: null, lookupFailed: true };
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
