import { cacheLife, cacheTag } from 'next/cache';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { TTL_T4_30D, TTL_T3_7D, TTL_T2_24H } from '@/lib/fundamental/cacheTtl';
import type {
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

const fundamentalClient = new FmpFundamentalClient();

export async function getProfile(
    symbol: string
): Promise<FundamentalProfileInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T4_30D });
    cacheTag(`fundamental:profile:${symbol}`);
    return fundamentalClient.getProfile(symbol);
}

export async function getStockPeers(
    symbol: string
): Promise<FundamentalPeerInput[]> {
    'use cache';
    cacheLife({ revalidate: TTL_T4_30D });
    cacheTag(`fundamental:stock-peers:${symbol}`);
    return fundamentalClient.getStockPeers(symbol);
}

export async function getKeyMetricsTtm(
    symbol: string
): Promise<FundamentalValuationMetrics | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:key-metrics-ttm:${symbol}`);
    return fundamentalClient.getKeyMetricsTtm(symbol);
}

export async function getRatiosTtm(
    symbol: string
): Promise<FundamentalRatiosInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:ratios-ttm:${symbol}`);
    return fundamentalClient.getRatiosTtm(symbol);
}

export async function getIncomeStatementGrowth(
    symbol: string
): Promise<FundamentalGrowthInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:income-statement-growth:${symbol}`);
    return fundamentalClient.getIncomeStatementGrowth(symbol);
}

export async function getFinancialScores(
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:financial-scores:${symbol}`);
    return fundamentalClient.getFinancialScores(symbol);
}

export async function getCashFlowStatement(
    symbol: string
): Promise<FundamentalCashFlowInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T3_7D });
    cacheTag(`fundamental:cash-flow-statement:${symbol}`);
    return fundamentalClient.getCashFlowStatement(symbol);
}

export async function getAnalystEstimates(
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:analyst-estimates:${symbol}`);
    return fundamentalClient.getAnalystEstimates(symbol);
}

export async function getGradesConsensus(
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:grades-consensus:${symbol}`);
    return fundamentalClient.getGradesConsensus(symbol);
}

export async function getPriceTargetConsensus(
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:price-target-consensus:${symbol}`);
    return fundamentalClient.getPriceTargetConsensus(symbol);
}

export async function getPriceTargetSummary(
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:price-target-summary:${symbol}`);
    return fundamentalClient.getPriceTargetSummary(symbol);
}

export async function getHistoricalSector(
    sector: string
): Promise<FundamentalSectorHistoricalInput[]> {
    'use cache';
    cacheLife({ revalidate: TTL_T2_24H });
    cacheTag(`fundamental:historical-sector:${sector}`);
    return fundamentalClient.getHistoricalSectorPerformance(sector);
}
