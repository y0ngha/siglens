import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleProfileDescriptionTranslationRepository,
    translateCompanyDescription,
} from '@/entities/ticker';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
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

// Redis 캐싱(`fundamental:*` 키)·per/psr enrich는 CachedFundamentalProvider
// (getFundamentalDataProvider가 반환)로 이관됐다. 페이지·core 분석 경로가 동일
// provider를 통과해 같은 캐시를 공유한다. 이 파일은 provider 위임 + DB 번역
// (getProfileDescriptionKo)만 담당한다.
const fundamentalClient = getFundamentalDataProvider();

export const getProfile = (
    symbol: string
): Promise<FundamentalProfile | null> => fundamentalClient.getProfile(symbol);

/**
 * 회사 설명의 한국어 번역을 반환하고, 최초 호출 시 DB에 저장해 배포 간에도
 * 유지한다. Read: DB 조회(히트 시 즉시). Write: Gemini 번역 → DB upsert(심볼당 최초 1회).
 *
 * `cache()` 래핑 의도: 같은 요청에서 description-Ko를 여러 번 조회해도 DB lookup·
 * 번역을 1회로 묶는다. 내부 `getProfile(symbol)`은 이제 단순 위임이지만, 프로바이더
 * (CachedFundamentalProvider)의 `getProfile`이 `React.cache`로 per-request dedup하므로,
 * 같은 요청에서 profile을 이미 다른 호출자가 가져왔다면 추가 FMP 호출이 발생하지 않는다.
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

export const getKeyMetricsTtm = (
    symbol: string
): Promise<FundamentalValuationMetrics | null> =>
    fundamentalClient.getKeyMetricsTtm(symbol);

// 캐싱·enrich가 CachedFundamentalProvider로 이관됐으므로 이중 처리 없이 위임한다.
export const getStockPeers = (
    symbol: string
): Promise<FundamentalPeerInput[]> => fundamentalClient.getStockPeers(symbol);

export const getRatiosTtm = (
    symbol: string
): Promise<FundamentalRatiosInput | null> =>
    fundamentalClient.getRatiosTtm(symbol);

export const getIncomeStatementGrowth = (
    symbol: string
): Promise<FundamentalGrowthInput | null> =>
    fundamentalClient.getIncomeStatementGrowth(symbol);

export const getFinancialScores = (
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> =>
    fundamentalClient.getFinancialScores(symbol);

export const getCashFlowStatement = (
    symbol: string
): Promise<FundamentalCashFlowInput | null> =>
    fundamentalClient.getCashFlowStatement(symbol);

export const getAnalystEstimates = (
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> =>
    fundamentalClient.getAnalystEstimates(symbol);

export const getGradesConsensus = (
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> =>
    fundamentalClient.getGradesConsensus(symbol);

export const getPriceTargetConsensus = (
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> =>
    fundamentalClient.getPriceTargetConsensus(symbol);

export const getPriceTargetSummary = (
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> =>
    fundamentalClient.getPriceTargetSummary(symbol);
