import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { sym } from './symKey';
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from './fundamentalClient';
import type { FmpEarningsReportItem } from './fundamentalClient';
import type {
    FundamentalProvider,
    FundamentalProviderWithRawPeers,
} from './fundamentalProvider.types';
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
export const PEER_LIMIT = 10;

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
/**
 * 우리가 페이지를 낼 수 있는 peer만 남긴다.
 *
 * FMP의 peer 목록에는 해외 상장이 섞여 온다(프로덕션 실측: `2353.TW`·`2357.TW`·
 * `2364.TW`·`2465.TW`·`6597.T`·`THS.L`·`PRO.MI`). 그대로 두면 둘이 같이 샌다 —
 * enrich 경로가 그 심볼로 `key-metrics-ttm`을 불러 **402**를 받고(주 21건), 화면의
 * peers 표는 `/{symbol}/fundamental` 링크를 거는데 그 라우트는 같은 판정으로 이미 404다.
 *
 * 판정은 `isAdmissibleSymbolShape` 하나로 통일한다 — `[symbol]` 9개 라우트와
 * 미들웨어(`proxy.ts`), `getAssetInfo`, 색인 판정이 모두 쓰는 그 함수이고, JSDoc이
 * "FMP 호출 이전 단계라 402가 원천적으로 발생하지 않는다"고 명시한 목적 그대로다.
 *
 * **두 경로에 모두 걸어야 한다.** enrich 경로(`getStockPeers`)만 고치면 402는 멎지만
 * 화면에 보이는 표는 raw 경로(`getStockPeersRaw`)에서 오므로 죽은 링크가 그대로 남는다.
 * 그래서 필터를 여기 한 곳에 두고 둘이 함께 부른다.
 *
 * 자르는 순서도 중요하다: **필터 → cap**. 반대로 하면 해외 상장이 상위 N을 차지한 만큼
 * 실제로 보여줄 수 있는 peer가 줄어든다.
 */
function serveablePeers(
    raw: readonly FundamentalPeerInput[]
): FundamentalPeerInput[] {
    return raw
        .filter(peer => isAdmissibleSymbolShape(peer.symbol))
        .slice(0, PEER_LIMIT);
}

export class CachedFundamentalProvider implements FundamentalProviderWithRawPeers {
    constructor(private readonly inner: FundamentalProvider) {}

    getProfile = cache((symbol: string): Promise<FundamentalProfile | null> =>
        getOrSetCache(`fundamental:profile:${sym(symbol)}`, TTL, () =>
            this.inner.getProfile(symbol)
        )
    );

    /**
     * inner(`getValuationRaw`)는 FMP 장애 시 throw한다 — 그 throw는 getOrSetCache의
     * `set` 단계 전에 전파되므로 장애 결과가 캐싱되지 않는다(poison 방지). 바깥의
     * `.catch`가 throw를 graceful null로 변환해, ErrorBoundary 없이 Suspense로만 감싼
     * `ValuationSection`(fundamental/page.tsx)과 분석 경로가 종전처럼 N/A를 렌더하게 한다.
     * 빈 200(데이터 없는 티커)은 정상 null로 캐싱돼 롱테일 트래픽의 재호출을 막는다.
     *
     * Redis 인프라 장애(get/set)는 이 `.catch`에 도달하지 않는다 — `getOrSetCache`가
     * Redis get/set 에러를 내부에서 catch해 graceful fallback(fetcher 직접 호출 또는
     * fresh 값 그대로 반환)하므로, `getOrSetCache`는 오직 fetcher(inner FMP)가 throw할
     * 때만 throw한다. 따라서 이 `.catch`는 내부 FMP 장애만 처리한다.
     *
     * 에러는 여기서 직접 로깅한다. fmpGet 경로의 logFmpPaymentRequiredError는 HTTP 402만
     * 처리하므로 5xx/429/timeout은 그 경로에서 로깅되지 않는다 — 로깅하지 않으면 일시적
     * FMP 장애가 `.catch`에서 흔적 없이 사라진다. 캐싱 결정(throw=no-cache)은 inner가,
     * 관측성(로깅)과 graceful null 변환은 이 데코레이터가 책임진다.
     */
    getKeyMetricsTtm = cache(
        (symbol: string): Promise<FundamentalValuationMetrics | null> =>
            getOrSetCache(`fundamental:key-metrics:${sym(symbol)}`, TTL, () =>
                this.inner.getKeyMetricsTtm(symbol)
            ).catch(error => {
                console.error(
                    '[CachedFundamentalProvider] key-metrics fetch failed (not cached):',
                    error
                );
                return null;
            })
    );

    /** valuation 장애를 로깅 후 캐싱 없이 graceful null로 변환 — 사유는 getKeyMetricsTtm JSDoc 참고. */
    getRatiosTtm = cache(
        (symbol: string): Promise<FundamentalRatiosInput | null> =>
            getOrSetCache(`fundamental:ratios:${sym(symbol)}`, TTL, () =>
                this.inner.getRatiosTtm(symbol)
            ).catch(error => {
                console.error(
                    '[CachedFundamentalProvider] ratios fetch failed (not cached):',
                    error
                );
                return null;
            })
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

    getGrades = cache((symbol: string): Promise<GradesEvent[]> =>
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
     * peer 목록을 fetch→top-N cap→per/psr enrich한 결과 전체를 `fundamental:peers:<SYM>`에
     * 캐싱한다. enrich를 캐시 fetcher 안에 두므로 warm 호출은 enriched 목록을 단일 Redis
     * GET으로 돌려받고(peer당 round-trip 0), cold 호출만 enrich한다. per/psr은 캐싱된
     * getKeyMetricsTtm(`fundamental:key-metrics:<peer>`)에서 가져오며, 그 메서드는 FMP
     * 장애 시 throw하지 않고 null을 돌려주므로(catch→null) 한 peer 실패가 전체를 중단시키지
     * 않는다. cold 캐시 시 peer당 동시 FMP 폭증(rate-limit)을 피해 순차 enrich하고(await된
     * accumulator를 잇는 async reduce — 다음 peer fetch는 직전 peer 완료 후에만 시작), 비정상
     * 적으로 큰 peer 목록은 PEER_LIMIT으로 제한한다.
     *
     * 목록은 `serveablePeers`로 먼저 거른다 — 402와 죽은 링크의 원인이 거기 있다.
     */
    getStockPeers = cache((symbol: string): Promise<FundamentalPeerInput[]> =>
        getOrSetCache(`fundamental:peers:${sym(symbol)}`, TTL, async () => {
            const raw = await this.inner.getStockPeers(symbol);
            const peers = serveablePeers(raw);
            // 이전에는 async reduce로 peer를 한 건씩 직렬 조회해 지연이 PEER_LIMIT배로
            // 누적됐다. 심볼 단위로 dedupe한 뒤 병렬 조회한다 — 직렬 루프가 보장했던
            // "중복 심볼은 상류 1회 호출"(첫 조회가 캐시를 채워 두 번째가 히트)을
            // 병렬에서도 유지하려면 dedupe가 필수다. 없으면 같은 심볼이 동시에 미스로
            // 떠서 FMP 호출이 중복된다.
            const uniqueSymbols = [...new Set(peers.map(peer => peer.symbol))];
            const metricsBySymbol = new Map(
                await Promise.all(
                    uniqueSymbols.map(
                        async symbol =>
                            [
                                symbol,
                                await this.getKeyMetricsTtm(symbol),
                            ] as const
                    )
                )
            );
            return peers.map(peer => {
                const metrics = metricsBySymbol.get(peer.symbol);
                return {
                    ...peer,
                    per: metrics?.peRatioTTM ?? null,
                    psr: metrics?.priceToSalesRatioTTM ?? null,
                };
            });
        })
    );

    /**
     * 페이지 전용 raw peer 목록(symbol/companyName/marketCap). per/psr enrich 없음 →
     * peer당 valuation fan-out 제거. PeersTable은 이 3개 필드만 렌더한다. enriched
     * `getStockPeers`는 FactLayer(분석 프롬프트) 전용으로 그대로 둔다. 비정상적으로
     * 큰 peer 목록을 방지하기 위해 enriched 경로와 동일하게 PEER_LIMIT으로 상한을 둔다.
     */
    getStockPeersRaw = cache(
        (symbol: string): Promise<FundamentalPeerInput[]> =>
            getOrSetCache(
                `fundamental:peers-raw:${sym(symbol)}`,
                TTL,
                async () => {
                    const raw = await this.inner.getStockPeers(symbol);
                    // 화면의 peers 표가 이 경로에서 온다 — 여기서 거르지 않으면
                    // 404로 가는 링크가 그대로 노출된다(`serveablePeers` 참고).
                    return serveablePeers(raw);
                }
            )
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

    // earnings: 실적 발표 시점 실시간성이 중요(no-store) → Redis TTL 미적용. fundamentalClient 주석 참고.
    getEarningsReport = (symbol: string): Promise<EarningsReport | null> =>
        this.inner.getEarningsReport(symbol);

    getEarningsReports = (
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]> =>
        this.inner.getEarningsReports(symbol, limit);

    // historical-sector: 현재 빈 stub이라 캐싱 불필요
    getHistoricalSectorPerformance = (
        sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> =>
        this.inner.getHistoricalSectorPerformance(sector);
}
