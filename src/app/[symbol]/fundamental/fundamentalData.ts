/**
 * `unstable_cache`-wrapped data fetchers for the fundamental analysis page.
 *
 * Lives in the `app/` layer so infrastructure imports are allowed.
 * Section components in `components/fundamental/sections/` receive resolved
 * domain types as props — they never touch infrastructure directly.
 */
import { unstable_cache } from 'next/cache';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import {
    TTL_T4_30D,
    TTL_T3_7D,
    TTL_T2_24H,
    TTL_T2_1H,
} from '@/components/fundamental/sections/cache';

// ─── T4: 30 days ────────────────────────────────────────────────────────────

export const getProfile = unstable_cache(
    async (symbol: string) => new FmpFundamentalClient().getProfile(symbol),
    ['fundamental:profile'],
    { revalidate: TTL_T4_30D, tags: ['fundamental:profile'] }
);

export const getStockPeers = unstable_cache(
    async (symbol: string) => new FmpFundamentalClient().getStockPeers(symbol),
    ['fundamental:stock-peers'],
    { revalidate: TTL_T4_30D, tags: ['fundamental:stock-peers'] }
);

// ─── T3: 7 days ─────────────────────────────────────────────────────────────

export const getKeyMetricsTtm = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getKeyMetricsTtm(symbol),
    ['fundamental:key-metrics-ttm'],
    { revalidate: TTL_T3_7D, tags: ['fundamental:key-metrics-ttm'] }
);

export const getRatiosTtm = unstable_cache(
    async (symbol: string) => new FmpFundamentalClient().getRatiosTtm(symbol),
    ['fundamental:ratios-ttm'],
    { revalidate: TTL_T3_7D, tags: ['fundamental:ratios-ttm'] }
);

export const getIncomeStatementGrowth = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getIncomeStatementGrowth(symbol),
    ['fundamental:income-statement-growth'],
    { revalidate: TTL_T3_7D, tags: ['fundamental:income-statement-growth'] }
);

export const getFinancialScores = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getFinancialScores(symbol),
    ['fundamental:financial-scores'],
    { revalidate: TTL_T3_7D, tags: ['fundamental:financial-scores'] }
);

export const getCashFlowStatement = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getCashFlowStatement(symbol),
    ['fundamental:cash-flow-statement'],
    { revalidate: TTL_T3_7D, tags: ['fundamental:cash-flow-statement'] }
);

// ─── T2: 24 hours ────────────────────────────────────────────────────────────

export const getAnalystEstimates = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getAnalystEstimates(symbol),
    ['fundamental:analyst-estimates'],
    { revalidate: TTL_T2_24H, tags: ['fundamental:analyst-estimates'] }
);

export const getGradesConsensus = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getGradesConsensus(symbol),
    ['fundamental:grades-consensus'],
    { revalidate: TTL_T2_24H, tags: ['fundamental:grades-consensus'] }
);

export const getPriceTargetConsensus = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getPriceTargetConsensus(symbol),
    ['fundamental:price-target-consensus'],
    { revalidate: TTL_T2_24H, tags: ['fundamental:price-target-consensus'] }
);

export const getPriceTargetSummary = unstable_cache(
    async (symbol: string) =>
        new FmpFundamentalClient().getPriceTargetSummary(symbol),
    ['fundamental:price-target-summary'],
    { revalidate: TTL_T2_24H, tags: ['fundamental:price-target-summary'] }
);

// ─── T2: 1 hour (date-keyed) ─────────────────────────────────────────────────

export function getSectorSnapshot(date: string) {
    return unstable_cache(
        async () =>
            new FmpFundamentalClient().getSectorPerformanceSnapshot(date),
        ['fundamental:sector-snapshot', date],
        { revalidate: TTL_T2_1H, tags: ['fundamental:sector-snapshot'] }
    )();
}

// ─── T2: 24 hours (sector-keyed) ────────────────────────────────────────────

export function getHistoricalSector(sector: string) {
    return unstable_cache(
        async () =>
            new FmpFundamentalClient().getHistoricalSectorPerformance(sector),
        ['fundamental:historical-sector', sector],
        { revalidate: TTL_T2_24H, tags: ['fundamental:historical-sector'] }
    )();
}
