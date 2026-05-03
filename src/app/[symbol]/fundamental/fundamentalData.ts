// `use cache`-backed data fetchers for the fundamental analysis page.
// Lives in the `app/` layer so infrastructure imports are allowed.
// Section components in `components/fundamental/sections/` receive resolved
// domain types as props — they never touch infrastructure directly.
import { cacheLife, cacheTag } from 'next/cache';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import {
    TTL_T4_30D,
    TTL_T3_7D,
    TTL_T2_24H,
    TTL_T2_1H,
} from '@/lib/fundamental/cacheTtl';
import type {
    FundamentalSectorPerformanceInput,
    FundamentalSectorHistoricalInput,
    FundamentalProfileInput,
    FundamentalPeerInput,
    FundamentalValuationMetrics,
    FundamentalRatiosInput,
    FundamentalGrowthInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';

// ─── T4: 30 days ────────────────────────────────────────────────────────────

export async function getProfile(
    symbol: string
): Promise<FundamentalProfileInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T4_30D });
    cacheTag(`fundamental:profile:${symbol}`);
    return new FmpFundamentalClient().getProfile(symbol);
}

export async function getStockPeers(
    symbol: string
): Promise<FundamentalPeerInput[]> {
    'use cache';
    cacheLife({ revalidate: TTL_T4_30D });
    cacheTag(`fundamental:stock-peers:${symbol}`);
    return new FmpFundamentalClient().getStockPeers(symbol);
}

// ─── T3: 7 days ─────────────────────────────────────────────────────────────

export async function getKeyMetricsTtm(
    symbol: string
): Promise<FundamentalValuationMetrics | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:key-metrics-ttm:${symbol}`);
    return new FmpFundamentalClient().getKeyMetricsTtm(symbol);
}

export async function getRatiosTtm(
    symbol: string
): Promise<FundamentalRatiosInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:ratios-ttm:${symbol}`);
    return new FmpFundamentalClient().getRatiosTtm(symbol);
}

export async function getIncomeStatementGrowth(
    symbol: string
): Promise<FundamentalGrowthInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:income-statement-growth:${symbol}`);
    return new FmpFundamentalClient().getIncomeStatementGrowth(symbol);
}

export async function getFinancialScores(
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:financial-scores:${symbol}`);
    return new FmpFundamentalClient().getFinancialScores(symbol);
}

export async function getCashFlowStatement(
    symbol: string
): Promise<FundamentalCashFlowInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:cash-flow-statement:${symbol}`);
    return new FmpFundamentalClient().getCashFlowStatement(symbol);
}

// ─── T2: 24 hours ────────────────────────────────────────────────────────────

export async function getAnalystEstimates(
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:analyst-estimates:${symbol}`);
    return new FmpFundamentalClient().getAnalystEstimates(symbol);
}

export async function getGradesConsensus(
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:grades-consensus:${symbol}`);
    return new FmpFundamentalClient().getGradesConsensus(symbol);
}

export async function getPriceTargetConsensus(
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:price-target-consensus:${symbol}`);
    return new FmpFundamentalClient().getPriceTargetConsensus(symbol);
}

export async function getPriceTargetSummary(
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:price-target-summary:${symbol}`);
    return new FmpFundamentalClient().getPriceTargetSummary(symbol);
}

// ─── KST date helper (re-exported for page layer convenience) ─────────────────
export { todayKstIsoDate } from '@/lib/dateKey';

// ─── T2: 1 hour (date-keyed) ─────────────────────────────────────────────────

export async function getSectorSnapshot(
    date: string
): Promise<FundamentalSectorPerformanceInput[]> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_1H });
    cacheTag(`fundamental:sector-snapshot:${date}`);
    return new FmpFundamentalClient().getSectorPerformanceSnapshot(date);
}

// ─── T2: 24 hours (sector-keyed) ────────────────────────────────────────────

export async function getHistoricalSector(
    sector: string
): Promise<FundamentalSectorHistoricalInput[]> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:historical-sector:${sector}`);
    return new FmpFundamentalClient().getHistoricalSectorPerformance(sector);
}
