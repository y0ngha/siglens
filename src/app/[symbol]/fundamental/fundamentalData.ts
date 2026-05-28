import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleProfileDescriptionTranslationRepository,
    translateCompanyDescription,
} from '@/entities/ticker';
import {
    FmpFundamentalClient,
    FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
} from '@/shared/api/fmp/fundamentalClient';
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
// 호출 중복을 막는다(예: 페이지 본문 + metadata). cross-request 캐싱은 아래
// getOrSetCache(Upstash Redis)가 담당 — Next Data Cache는 region별/배포마다
// 초기화되어 봇 트래픽이 같은 티커를 반복 fetch하던 문제를 해결한다(이슈 #439).
const fundamentalClient = new FmpFundamentalClient();

// Redis TTL은 FmpFundamentalClient의 Next Data Cache `revalidate`와 동일한 단일 상수를
// 공유한다 — 신선도는 그대로 두고 Redis는 cross-region 공유 + 배포 생존만 추가한다.
// Redis miss 시에도 fmpGet의 Data Cache가 2차 fallback으로 남아 blast radius가 작다.
const FUNDAMENTAL_CACHE_TTL_SECONDS = FMP_FUNDAMENTAL_REVALIDATE_SECONDS;

// Upstash get은 miss와 저장된 null을 구분하지 못하므로, object|null 펀더멘탈은
// transient null(FMP 장애)을 캐싱하지 않는다 — "get null = miss" 불변식 유지.
const cacheNonNull = <T>(value: T | null): value is T => value !== null;

export const getProfile = cache(
    async (symbol: string): Promise<FundamentalProfile | null> =>
        getOrSetCache(
            `fundamental:profile:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getProfile(symbol),
            cacheNonNull
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

// peers는 빈 배열도 캐싱한다 — getStockPeers는 FMP 장애 시 throw하므로(getOptionalArray
// 미경유) 빈 배열은 "동종업체 없음"이라는 정상·안정 결과다. 빈 결과를 캐싱하지 않으면
// 해당 티커는 매 요청 FMP를 다시 친다.
export const getStockPeers = cache(
    async (symbol: string): Promise<FundamentalPeerInput[]> =>
        getOrSetCache(
            `fundamental:peers:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getStockPeers(symbol)
        )
);

export const getKeyMetricsTtm = cache(
    async (symbol: string): Promise<FundamentalValuationMetrics | null> =>
        getOrSetCache(
            `fundamental:key-metrics:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getKeyMetricsTtm(symbol),
            cacheNonNull
        )
);

export const getRatiosTtm = cache(
    async (symbol: string): Promise<FundamentalRatiosInput | null> =>
        getOrSetCache(
            `fundamental:ratios:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getRatiosTtm(symbol),
            cacheNonNull
        )
);

export const getIncomeStatementGrowth = cache(
    async (symbol: string): Promise<FundamentalGrowthInput | null> =>
        getOrSetCache(
            `fundamental:growth:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getIncomeStatementGrowth(symbol),
            cacheNonNull
        )
);

export const getFinancialScores = cache(
    async (symbol: string): Promise<FundamentalFinancialScoresInput | null> =>
        getOrSetCache(
            `fundamental:scores:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getFinancialScores(symbol),
            cacheNonNull
        )
);

export const getCashFlowStatement = cache(
    async (symbol: string): Promise<FundamentalCashFlowInput | null> =>
        getOrSetCache(
            `fundamental:cash-flow:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getCashFlowStatement(symbol),
            cacheNonNull
        )
);

export const getAnalystEstimates = cache(
    async (symbol: string): Promise<FundamentalAnalystEstimateInput | null> =>
        getOrSetCache(
            `fundamental:estimates:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getAnalystEstimates(symbol),
            cacheNonNull
        )
);

export const getGradesConsensus = cache(
    async (symbol: string): Promise<FundamentalGradesConsensusInput | null> =>
        getOrSetCache(
            `fundamental:grades-consensus:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getGradesConsensus(symbol),
            cacheNonNull
        )
);

export const getPriceTargetConsensus = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> =>
        getOrSetCache(
            `fundamental:price-target-consensus:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getPriceTargetConsensus(symbol),
            cacheNonNull
        )
);

export const getPriceTargetSummary = cache(
    async (
        symbol: string
    ): Promise<FundamentalPriceTargetSummaryInput | null> =>
        getOrSetCache(
            `fundamental:price-target-summary:${symbol.toUpperCase()}`,
            FUNDAMENTAL_CACHE_TTL_SECONDS,
            () => fundamentalClient.getPriceTargetSummary(symbol),
            cacheNonNull
        )
);
