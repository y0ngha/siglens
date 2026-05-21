import { cache } from 'react';
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
// 동일 요청 내 중복 호출은 React.cache로 per-request memoization을 적용해
// FMP HTTP 호출 중복을 막는다. cross-request 캐싱은 손실 — PPR 재활성화 또는
// unstable_cache 도입 시 복원할 것 (관련 GitHub 이슈 참조).
const fundamentalClient = new FmpFundamentalClient();

export const getProfile = cache(
    async (symbol: string): Promise<FundamentalProfile | null> => {
        return fundamentalClient.getProfile(symbol);
    }
);

/**
 * Returns the Korean translation of the company description, storing it in
 * the DB on first call so it persists across deployments.
 *
 * Read path: DB lookup (instant on cache hit).
 * Write path: Gemini translation → DB upsert (first visit per symbol only).
 */
export const getProfileDescriptionKo = cache(
    async (symbol: string): Promise<string | null> => {
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
);

export const getStockPeers = cache(
    async (symbol: string): Promise<FundamentalPeerInput[]> => {
        return fundamentalClient.getStockPeers(symbol);
    }
);

export const getKeyMetricsTtm = cache(
    async (symbol: string): Promise<FundamentalValuationMetrics | null> => {
        return fundamentalClient.getKeyMetricsTtm(symbol);
    }
);

export const getRatiosTtm = cache(
    async (symbol: string): Promise<FundamentalRatiosInput | null> => {
        return fundamentalClient.getRatiosTtm(symbol);
    }
);

export const getIncomeStatementGrowth = cache(
    async (symbol: string): Promise<FundamentalGrowthInput | null> => {
        return fundamentalClient.getIncomeStatementGrowth(symbol);
    }
);

export const getFinancialScores = cache(
    async (symbol: string): Promise<FundamentalFinancialScoresInput | null> => {
        return fundamentalClient.getFinancialScores(symbol);
    }
);

export const getCashFlowStatement = cache(
    async (symbol: string): Promise<FundamentalCashFlowInput | null> => {
        return fundamentalClient.getCashFlowStatement(symbol);
    }
);

export const getAnalystEstimates = cache(
    async (symbol: string): Promise<FundamentalAnalystEstimateInput | null> => {
        return fundamentalClient.getAnalystEstimates(symbol);
    }
);

export const getGradesConsensus = cache(
    async (
        symbol: string
    ): Promise<FundamentalGradesConsensusInput | null> => {
        return fundamentalClient.getGradesConsensus(symbol);
    }
);

export const getPriceTargetConsensus = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> => {
        return fundamentalClient.getPriceTargetConsensus(symbol);
    }
);

export const getPriceTargetSummary = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetSummaryInput | null> => {
        return fundamentalClient.getPriceTargetSummary(symbol);
    }
);
