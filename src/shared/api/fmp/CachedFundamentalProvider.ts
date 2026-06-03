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

    /**
     * inner(`getValuationRaw`)는 FMP 장애 시 throw한다 — 그 throw는 getOrSetCache의
     * `set` 단계 전에 전파되므로 장애 결과가 캐싱되지 않는다(poison 방지). 바깥의
     * `.catch(() => null)`이 throw를 graceful null로 변환해, ErrorBoundary 없이
     * Suspense로만 감싼 `ValuationSection`(fundamental/page.tsx)과 분석 경로가
     * 종전처럼 N/A를 렌더하게 한다. 에러는 fmpGet 경로의 logFmpPaymentRequiredError로
     * 이미 로깅되므로 여기서 중복 로깅하지 않는다. 빈 200(데이터 없는 티커)은 정상
     * null로 캐싱돼 롱테일 트래픽의 재호출을 막는다.
     */
    getKeyMetricsTtm = cache(
        (symbol: string): Promise<FundamentalValuationMetrics | null> =>
            getOrSetCache(`fundamental:key-metrics:${sym(symbol)}`, TTL, () =>
                this.inner.getKeyMetricsTtm(symbol)
            ).catch(() => null)
    );

    /** valuation 장애를 캐싱 없이 graceful null로 변환 — 사유는 getKeyMetricsTtm JSDoc 참고. */
    getRatiosTtm = cache(
        (symbol: string): Promise<FundamentalRatiosInput | null> =>
            getOrSetCache(`fundamental:ratios:${sym(symbol)}`, TTL, () =>
                this.inner.getRatiosTtm(symbol)
            ).catch(() => null)
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

    /**
     * raw peer 목록을 `fundamental:peers:<SYM>`에 캐싱한 뒤, 각 peer를 캐싱된
     * `getKeyMetricsTtm`으로 enrich해 per/psr을 채운다. 페이지·분석이 동일한
     * enrich된 peer를 받아 core 프롬프트의 PER/PSR이 정상 채워진다(기존엔 분석
     * 경로가 enrich되지 않은 raw peer를 받아 PER/PSR이 N/A였다).
     *
     * enrich는 콜드 캐시 시 peer당 동시 FMP 요청 폭증(rate-limit)을 피하려 순차
     * 실행한다 — warm 캐시에서는 getKeyMetricsTtm(Redis) 히트로 비용이 낮다.
     */
    getStockPeers = cache(
        async (symbol: string): Promise<FundamentalPeerInput[]> => {
            const peers = await getOrSetCache(
                `fundamental:peers:${sym(symbol)}`,
                TTL,
                () => this.inner.getStockPeers(symbol)
            );
            const enriched: FundamentalPeerInput[] = [];
            for (const peer of peers) {
                const metrics = await this.getKeyMetricsTtm(peer.symbol);
                enriched.push({
                    ...peer,
                    per: metrics?.peRatioTTM ?? null,
                    psr: metrics?.priceToSalesRatioTTM ?? null,
                });
            }
            return enriched;
        }
    );

    /**
     * 섹터 스냅샷은 날짜 단위 데이터이므로 키를 `<DATE>`로 잡는다(심볼 무관).
     * 분석 경로에서만 호출되며 기존엔 무캐시였다 — 캐싱으로 분석마다의 FMP 호출을 막는다.
     */
    getSectorPerformanceSnapshot = cache(
        (date: string): Promise<FundamentalSectorPerformanceInput[]> =>
            getOrSetCache(`fundamental:sector-performance:${date}`, TTL, () =>
                this.inner.getSectorPerformanceSnapshot(date)
            )
    );

    // pass-through (no-store + DB 영속 / 빈 stub)
    getHistoricalSectorPerformance = (
        sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> =>
        this.inner.getHistoricalSectorPerformance(sector);

    // pass-through (no-store + DB 영속 / 빈 stub)
    getEarningsReport = (symbol: string): Promise<EarningsReport | null> =>
        this.inner.getEarningsReport(symbol);

    // pass-through (no-store + DB 영속 / 빈 stub)
    getEarningsReports = (
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]> =>
        this.inner.getEarningsReports(symbol, limit);
}
