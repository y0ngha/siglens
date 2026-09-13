import 'server-only';
import { summarizeChainForLlm } from '@y0ngha/siglens-core';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
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
    const chain = snapshot.chains[0]!;
    return {
        asOf: snapshot.capturedAt,
        source: 'options snapshot (cached)',
        symbol,
        available: true,
        currency: 'USD',
        underlyingPrice: snapshot.underlyingPrice,
        expiration: chain.expirationDate,
        daysToExpiration: chain.daysToExpiration,
        metrics: summarizeChainForLlm(chain, snapshot.underlyingPrice),
        otherExpirations: snapshot.chains
            .slice(1, 4)
            .map(c => c.expirationDate),
    };
};
