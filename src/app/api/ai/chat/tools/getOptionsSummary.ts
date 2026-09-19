import 'server-only';
import { summarizeChainForLlm } from '@y0ngha/siglens-core';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { roundNumbersDeep } from '@/entities/bars/lib/roundIndicators';
import type { ToolExecutor } from './index';

export const getOptionsSummaryTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    // Tab-policy gate BEFORE the Yahoo options-market probe — crypto/KR
    // symbols never have an options tab, so this skips a wasted network
    // round-trip on top of matching the options page's own gate
    // (`app/[locale]/[symbol]/options/page.tsx`).
    if (!(await isTabAllowedForSymbol(symbol, 'options')))
        return { symbol, available: false, reason: 'tab_not_available' };
    if (!(await hasOptionsMarket(symbol)))
        return { symbol, available: false, reason: 'no_options_market' };
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null || snapshot.chains.length === 0)
        return { symbol, available: false, reason: 'no_snapshot' };
    // chains[0] can be a same-day (daysToExpiration 0) expiry, which makes
    // the implied-move metric null — prefer the first chain with at least
    // one day left, falling back to chains[0] if every chain expires today.
    const chosenIndex = snapshot.chains.findIndex(c => c.daysToExpiration >= 1);
    const chainIndex = chosenIndex >= 0 ? chosenIndex : 0;
    const chain = snapshot.chains[chainIndex]!;
    return {
        asOf: snapshot.capturedAt,
        source: 'options snapshot (cached)',
        symbol,
        available: true,
        currency: 'USD',
        underlyingPrice: snapshot.underlyingPrice,
        expiration: chain.expirationDate,
        daysToExpiration: chain.daysToExpiration,
        // Core returns raw floats (implied move range, spreads, IV); trim them
        // to significant digits like the options analysis prompt does.
        metrics: roundNumbersDeep(
            summarizeChainForLlm(chain, snapshot.underlyingPrice)
        ),
        otherExpirations: snapshot.chains
            .filter((_, i) => i !== chainIndex)
            .slice(0, 3)
            .map(c => c.expirationDate),
    };
};
