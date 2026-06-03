import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleProfileDescriptionTranslationRepository,
    translateCompanyDescription,
} from '@/entities/ticker';
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from '@/shared/api/fmp/fundamentalClient';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
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

// 동일 요청 내 중복 호출은 React.cache로 per-request memoization을 적용해 FMP HTTP
// 호출 중복을 막는다(예: 페이지 본문 + metadata). cross-request 캐싱은 getOrSetCache
// (Upstash Redis, TTL = FMP_FUNDAMENTAL_REVALIDATE_SECONDS — Next Data Cache `revalidate`와
// 같은 단일 freshness 상수)가 담당한다. Next Data Cache는 region별/배포마다 초기화되어
// 봇 트래픽이 같은 티커를 반복 fetch하던 문제를 해결한다(이슈 #439). getOrSetCache가 값을
// envelope으로 감싸므로 null·빈 배열("데이터 없음")도 캐싱돼 데이터 없는 티커도 재호출되지
// 않는다 — fmpGet은 장애 시 throw하므로 일시 실패가 캐싱될 일은 없다.
//
// Redis 키 네임스페이스 `fundamental:*` — 이 파일이 11개 키를 소유하고,
// newsData.ts의 `fundamental:grades:*`(getGradeEvents)도 같은 네임스페이스를 공유한다.
// 키를 rename할 때는 두 파일을 함께 수정할 것.
const fundamentalClient = getFundamentalDataProvider();

export const getProfile = cache(
    async (symbol: string): Promise<FundamentalProfile | null> =>
        getOrSetCache(
            `fundamental:profile:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getProfile(symbol)
        )
);

/**
 * Returns the Korean translation of the company description, storing it in
 * the DB on first call so it persists across deployments.
 *
 * Read path: DB lookup (instant on cache hit).
 * Write path: Gemini translation → DB upsert (first visit per symbol only).
 *
 * Nested `cache()` 호출 의도: 이 함수와 내부에서 호출하는 `getProfile`이 둘 다
 * 별도 per-request memoization을 갖는다. 같은 요청에서 description-Ko 미스이지만
 * profile은 이미 다른 호출자가 캐싱한 경우, 내부 `getProfile(symbol)`이 추가 FMP
 * 호출을 발생시키지 않는다.
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

export const getKeyMetricsTtm = cache(
    async (symbol: string): Promise<FundamentalValuationMetrics | null> =>
        getOrSetCache(
            `fundamental:key-metrics:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getKeyMetricsTtm(symbol)
        )
);

// CachedFundamentalProvider.getStockPeers가 peers 캐싱 + per/psr enrich를 일괄
// 처리한다(peers fetch → key-metrics enrich → Redis 캐시). 이 레이어는 이중
// enrich 없이 프로바이더에 위임한다.
export const getStockPeers = cache(
    (symbol: string): Promise<FundamentalPeerInput[]> =>
        fundamentalClient.getStockPeers(symbol)
);

export const getRatiosTtm = cache(
    async (symbol: string): Promise<FundamentalRatiosInput | null> =>
        getOrSetCache(
            `fundamental:ratios:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getRatiosTtm(symbol)
        )
);

export const getIncomeStatementGrowth = cache(
    async (symbol: string): Promise<FundamentalGrowthInput | null> =>
        getOrSetCache(
            `fundamental:growth:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getIncomeStatementGrowth(symbol)
        )
);

export const getFinancialScores = cache(
    async (symbol: string): Promise<FundamentalFinancialScoresInput | null> =>
        getOrSetCache(
            `fundamental:scores:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getFinancialScores(symbol)
        )
);

export const getCashFlowStatement = cache(
    async (symbol: string): Promise<FundamentalCashFlowInput | null> =>
        getOrSetCache(
            `fundamental:cash-flow:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getCashFlowStatement(symbol)
        )
);

export const getAnalystEstimates = cache(
    async (symbol: string): Promise<FundamentalAnalystEstimateInput | null> =>
        getOrSetCache(
            `fundamental:estimates:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getAnalystEstimates(symbol)
        )
);

export const getGradesConsensus = cache(
    async (symbol: string): Promise<FundamentalGradesConsensusInput | null> =>
        getOrSetCache(
            `fundamental:grades-consensus:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getGradesConsensus(symbol)
        )
);

export const getPriceTargetConsensus = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> =>
        getOrSetCache(
            `fundamental:price-target-consensus:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getPriceTargetConsensus(symbol)
        )
);

export const getPriceTargetSummary = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetSummaryInput | null> =>
        getOrSetCache(
            `fundamental:price-target-summary:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getPriceTargetSummary(symbol)
        )
);
