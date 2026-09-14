import 'server-only';
import { summarizeCongressTrades } from '@y0ngha/siglens-core';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getCongressTradesResilient } from '@/entities/congress-trades';
import type { ToolExecutor } from './index';

/** Caps the raw trade list; `stats` already covers the full-set trend. */
const TRADES_MAX = 15;

/**
 * Recent disclosed congressional trades in a US stock (tab-gated the same
 * way `getOptionsSummaryTool` gates options — Korean/crypto symbols never
 * have a congress tab). `degraded:true` (FMP infra failure) maps to
 * `available:false`; a genuine 0-trade result stays `available:true` with an
 * empty list — that distinction is `getCongressTradesResilient`'s job.
 */
export const getCongressTradesTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'congress')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const { trades, degraded } = await getCongressTradesResilient(symbol);
    if (degraded)
        return { symbol, available: false, reason: 'provider_failed' };

    return {
        asOf: new Date().toISOString(),
        source: 'congress trades (FMP)',
        symbol,
        available: true,
        stats: summarizeCongressTrades(trades),
        trades: trades.slice(0, TRADES_MAX).map(t => ({
            transactionDate: t.transactionDate,
            member: `${t.firstName} ${t.lastName}`,
            chamber: t.chamber,
            side: t.side,
            amount: t.amount.label,
        })),
    };
};
