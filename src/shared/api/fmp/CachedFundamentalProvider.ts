import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from './fundamentalClient';
import type { FmpEarningsReportItem } from './fundamentalClient';
import type { FundamentalProvider } from './getFundamentalDataProvider';
import type {
    EarningsReport,
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalFinancialScoresInput,
    FundamentalGradesConsensusInput,
    FundamentalGrowthInput,
    FundamentalPeerInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
    FundamentalProfile,
    FundamentalRatiosInput,
    FundamentalSectorHistoricalInput,
    FundamentalSectorPerformanceInput,
    FundamentalValuationMetrics,
    GradesEvent,
} from '@y0ngha/siglens-core';

const TTL = FMP_FUNDAMENTAL_REVALIDATE_SECONDS;
const sym = (s: string): string => s.toUpperCase();

/**
 * `FundamentalProvider`를 감싸 메서드별 Redis 캐싱을 주입하는 데코레이터.
 *
 * 페이지 SSR(`fundamentalData.ts`)과 core 분석 경로(provider 주입)가 둘 다 이
 * 데코레이터를 통과하므로 동일한 `fundamental:*` 캐시를 공유한다 — 한쪽이 워밍한
 * 데이터를 다른 쪽이 재사용해 FMP 호출을 절감한다. 각 메서드는 `React.cache`로
 * RSC 요청 스코프 dedup + `getOrSetCache`로 cross-request 캐싱을 적용한다
 * (`barsDataCache`와 동일 형태). 키/TTL은 기존 `fundamentalData.ts`·`newsData.ts`
 * 스킴을 그대로 따른다.
 *
 * earnings(no-store + DB 영속)와 historical-sector(빈 stub)는 pass-through한다.
 */
export class CachedFundamentalProvider implements FundamentalProvider {
    constructor(private readonly inner: FundamentalProvider) {}

    getProfile = cache(
        (symbol: string): Promise<FundamentalProfile | null> =>
            getOrSetCache(`fundamental:profile:${sym(symbol)}`, TTL, () =>
                this.inner.getProfile(symbol)
            )
    );

    getKeyMetricsTtm = cache(
        (symbol: string): Promise<FundamentalValuationMetrics | null> =>
            getOrSetCache(`fundamental:key-metrics:${sym(symbol)}`, TTL, () =>
                this.inner.getKeyMetricsTtm(symbol)
            )
    );

    getRatiosTtm = cache(
        (symbol: string): Promise<FundamentalRatiosInput | null> =>
            getOrSetCache(`fundamental:ratios:${sym(symbol)}`, TTL, () =>
                this.inner.getRatiosTtm(symbol)
            )
    );

    getCashFlowStatement = cache(
        (symbol: string): Promise<FundamentalCashFlowInput | null> =>
            getOrSetCache(`fundamental:cash-flow:${sym(symbol)}`, TTL, () =>
                this.inner.getCashFlowStatement(symbol)
            )
    );

    getIncomeStatementGrowth = cache(
        (symbol: string): Promise<FundamentalGrowthInput | null> =>
            getOrSetCache(`fundamental:growth:${sym(symbol)}`, TTL, () =>
                this.inner.getIncomeStatementGrowth(symbol)
            )
    );

    getFinancialScores = cache(
        (symbol: string): Promise<FundamentalFinancialScoresInput | null> =>
            getOrSetCache(`fundamental:scores:${sym(symbol)}`, TTL, () =>
                this.inner.getFinancialScores(symbol)
            )
    );

    getAnalystEstimates = cache(
        (symbol: string): Promise<FundamentalAnalystEstimateInput | null> =>
            getOrSetCache(`fundamental:estimates:${sym(symbol)}`, TTL, () =>
                this.inner.getAnalystEstimates(symbol)
            )
    );

    getGrades = cache(
        (symbol: string): Promise<GradesEvent[]> =>
            getOrSetCache(`fundamental:grades:${sym(symbol)}`, TTL, () =>
                this.inner.getGrades(symbol)
            )
    );

    getGradesConsensus = cache(
        (symbol: string): Promise<FundamentalGradesConsensusInput | null> =>
            getOrSetCache(
                `fundamental:grades-consensus:${sym(symbol)}`,
                TTL,
                () => this.inner.getGradesConsensus(symbol)
            )
    );

    getPriceTargetConsensus = cache(
        (
            symbol: string
        ): Promise<FundamentalPriceTargetConsensusInput | null> =>
            getOrSetCache(
                `fundamental:price-target-consensus:${sym(symbol)}`,
                TTL,
                () => this.inner.getPriceTargetConsensus(symbol)
            )
    );

    getPriceTargetSummary = cache(
        (symbol: string): Promise<FundamentalPriceTargetSummaryInput | null> =>
            getOrSetCache(
                `fundamental:price-target-summary:${sym(symbol)}`,
                TTL,
                () => this.inner.getPriceTargetSummary(symbol)
            )
    );

    // Task 3에서 캐싱+enrich로 교체할 pass-through stub.
    getStockPeers = (symbol: string): Promise<FundamentalPeerInput[]> =>
        this.inner.getStockPeers(symbol);

    // Task 4에서 캐싱으로 교체할 pass-through stub.
    getSectorPerformanceSnapshot = (
        date: string
    ): Promise<FundamentalSectorPerformanceInput[]> =>
        this.inner.getSectorPerformanceSnapshot(date);

    getHistoricalSectorPerformance = (
        sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> =>
        this.inner.getHistoricalSectorPerformance(sector);

    getEarningsReport = (symbol: string): Promise<EarningsReport | null> =>
        this.inner.getEarningsReport(symbol);

    getEarningsReports = (
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]> =>
        this.inner.getEarningsReports(symbol, limit);
}
