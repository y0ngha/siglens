import 'server-only';
import type { StockSignalResult } from '@y0ngha/siglens-core';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import type { ToolExecutor } from './index';

/** Capped so a busy signal scan (dozens of flagged stocks) stays inside the tool's budget. */
const TOP_SIGNALS_MAX = 10;

function countsBySector(
    stocks: readonly StockSignalResult[]
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of stocks)
        counts[s.sectorSymbol] = (counts[s.sectorSymbol] ?? 0) + 1;
    return counts;
}

function topSignals(stocks: readonly StockSignalResult[]) {
    return stocks
        .flatMap(s =>
            s.signals.map(sig => ({
                symbol: s.symbol,
                sectorSymbol: s.sectorSymbol,
                type: sig.type,
                direction: sig.direction,
            }))
        )
        .slice(0, TOP_SIGNALS_MAX);
}

/**
 * Market-wide mood: fear & greed + index/sector levels, plus (US only) the
 * dashboard's sector signal scan compacted to per-sector counts and the top
 * flagged signals. `Promise.allSettled` so one failing section (e.g. the
 * signal scan) never blanks the fear & greed or index data.
 */
export const getMarketOverviewTool: ToolExecutor = async args => {
    const market = args.market === 'kr' ? 'kr' : 'us';
    const scope = dashboardScopeOf(market);
    const [fgResult, summaryResult, sectorResult] = await Promise.allSettled([
        market === 'kr'
            ? getMarketFearGreedKrStatic()
            : getMarketFearGreedStatic(),
        getMarketSummaryStatic(scope),
        market === 'us'
            ? getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME)
            : Promise.resolve(null),
    ]);

    const fearGreedView =
        fgResult.status === 'fulfilled' ? fgResult.value : null;
    const summary =
        summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const sectorSignals =
        sectorResult.status === 'fulfilled' ? sectorResult.value : null;
    const fg = fearGreedView?.snapshot ?? null;

    return {
        asOf: new Date().toISOString(),
        source: 'market dashboard cache (1h)',
        market,
        fearGreed: fg && {
            score: fg.score,
            label: fg.label,
            factors: fg.factors.map(f => ({
                key: f.key,
                percentile: f.percentile,
            })),
        },
        indices:
            summary?.indices.map(i => ({
                symbol: i.symbol,
                price: i.price,
                changesPercentage: i.changesPercentage,
            })) ?? [],
        sectors:
            summary?.sectors.map(s => ({
                symbol: s.symbol,
                price: s.price,
                changesPercentage: s.changesPercentage,
            })) ?? [],
        sectorSignals: sectorSignals && {
            computedAt: sectorSignals.computedAt,
            countsBySector: countsBySector(sectorSignals.stocks),
            topSignals: topSignals(sectorSignals.stocks),
        },
    };
};
