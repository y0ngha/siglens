import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleProfileDescriptionTranslationRepository } from '@/infrastructure/db/tickerRepository';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { translateCompanyDescription } from '@/infrastructure/ticker/koreanTranslator';
import { TTL_T4_30D, TTL_T3_7D, TTL_T2_24H } from '@/lib/fundamental/cacheTtl';
import type {
    FundamentalProfile,
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
): Promise<FundamentalProfile | null> {
    'use cache';
    cacheLife({ revalidate: TTL_T4_30D });
    cacheTag(`fundamental:profile:${symbol}`);
    return fundamentalClient.getProfile(symbol);
}

/**
 * Returns the Korean translation of the company description, storing it in
 * the DB on first call so it persists across deployments.
 *
 * Read path: DB lookup (instant on cache hit).
 * Write path: Gemini translation → DB upsert (first visit per symbol only).
 *
 * `'use cache'` 대신 React.cache를 쓰는 이유: 함수가 DB upsert + 외부 Gemini
 * 호출이라는 side effect를 갖는다. Next.js 'use cache'는 pure read에 적합하고
 * 첫 write 이후의 cache invalidation 보장이 까다로워, per-request dedup만으로
 * 충분한 이 함수는 React.cache로 처리한다. 내부에서 호출하는 `getProfile`은
 * 'use cache'가 적용되어 cross-request memoization이 그대로 동작한다.
 */
export const getProfileDescriptionKo = cache(
    async (symbol: string): Promise<string | null> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);

        const existing = await repo.findBySymbol(symbol);
        if (existing !== null) return existing.descriptionKo;

        const profile = await getProfile(symbol);
        if (profile === null || profile.description === null) return null;

        const translated = await translateCompanyDescription(
            profile.description
        );
        if (translated === null) return null;

        await repo.upsert({ symbol, descriptionKo: translated });
        return translated;
    }
);

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
