import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleProfileDescriptionTranslationRepository } from '@/infrastructure/db/tickerRepository';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { translateCompanyDescription } from '@/infrastructure/ticker/koreanTranslator';
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

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag를 모두 제거.
// FMP 호출 캐싱은 임시로 손실. PPR 재활성화 또는 unstable_cache 도입 시 복원할 것
// (관련 GitHub 이슈 참조).
const fundamentalClient = new FmpFundamentalClient();

export async function getProfile(
    symbol: string
): Promise<FundamentalProfile | null> {
    return fundamentalClient.getProfile(symbol);
}

/**
 * Returns the Korean translation of the company description, storing it in
 * the DB on first call so it persists across deployments.
 *
 * Read path: DB lookup (instant on cache hit).
 * Write path: Gemini translation → DB upsert (first visit per symbol only).
 */
export async function getProfileDescriptionKo(
    symbol: string
): Promise<string | null> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleProfileDescriptionTranslationRepository(db);

    const existing = await repo.findBySymbol(symbol);
    if (existing !== null) return existing.descriptionKo;

    const profile = await getProfile(symbol);
    if (profile === null || profile.description === null) return null;

    const translated = await translateCompanyDescription(profile.description);
    if (translated === null) return null;

    await repo.upsert({ symbol, descriptionKo: translated });
    return translated;
}

export async function getStockPeers(
    symbol: string
): Promise<FundamentalPeerInput[]> {
    return fundamentalClient.getStockPeers(symbol);
}

export async function getKeyMetricsTtm(
    symbol: string
): Promise<FundamentalValuationMetrics | null> {
    return fundamentalClient.getKeyMetricsTtm(symbol);
}

export async function getRatiosTtm(
    symbol: string
): Promise<FundamentalRatiosInput | null> {
    return fundamentalClient.getRatiosTtm(symbol);
}

export async function getIncomeStatementGrowth(
    symbol: string
): Promise<FundamentalGrowthInput | null> {
    return fundamentalClient.getIncomeStatementGrowth(symbol);
}

export async function getFinancialScores(
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> {
    return fundamentalClient.getFinancialScores(symbol);
}

export async function getCashFlowStatement(
    symbol: string
): Promise<FundamentalCashFlowInput | null> {
    return fundamentalClient.getCashFlowStatement(symbol);
}

export async function getAnalystEstimates(
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> {
    return fundamentalClient.getAnalystEstimates(symbol);
}

export async function getGradesConsensus(
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> {
    return fundamentalClient.getGradesConsensus(symbol);
}

export async function getPriceTargetConsensus(
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> {
    return fundamentalClient.getPriceTargetConsensus(symbol);
}

export async function getPriceTargetSummary(
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> {
    return fundamentalClient.getPriceTargetSummary(symbol);
}
