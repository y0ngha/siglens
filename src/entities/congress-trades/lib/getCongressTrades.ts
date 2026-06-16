import { normalizeCongressTrades } from '@y0ngha/siglens-core';
import type { CongressTrade, RawCongressTrade } from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

/** Display cap — FMP can return 100+; we cap at 50 for performance (부록 D #4). */
const CONGRESS_TRADE_LIMIT = 50;

/**
 * Fetches raw senate + house trades for `symbol` (each via `staticSymbolCache`
 * for the Next Data Cache layer), then normalizes ONCE via core's
 * `normalizeCongressTrades` → sorted `CongressTrade[]`.
 *
 * Both chambers share the `congress:${symbol}` group tag for on-demand
 * invalidation (e.g. after an ingestion job refreshes congress data).
 */
export async function getCongressTrades(
    symbol: string
): Promise<CongressTrade[]> {
    const upper = symbol.toUpperCase();
    const provider = getCongressTradesProvider();
    const groupTag = `congress:${upper}`;

    const [senate, house] = await Promise.all([
        staticSymbolCache<RawCongressTrade[]>(
            ['congress:senate', upper],
            upper,
            () => provider.getTrades(upper, 'senate', CONGRESS_TRADE_LIMIT),
            [groupTag]
        ),
        staticSymbolCache<RawCongressTrade[]>(
            ['congress:house', upper],
            upper,
            () => provider.getTrades(upper, 'house', CONGRESS_TRADE_LIMIT),
            [groupTag]
        ),
    ]);

    // never throws — caller relies on [] for empty input
    return normalizeCongressTrades(senate, house);
}
