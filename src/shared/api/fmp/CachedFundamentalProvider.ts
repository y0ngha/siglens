import 'server-only';
import { cache } from 'react';
import { getOrSetCache, setCacheValue } from '@/shared/cache/getOrSetCache';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { sym } from './symKey';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';
import type { FmpEarningsReportItem } from './fundamentalClient';
import type {
    FundamentalProvider,
    FundamentalProviderWithRawPeers,
} from './fundamentalProvider.types';
import type {
    CashFlowRow,
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
    IncomeGrowthRow,
} from '@y0ngha/siglens-core';

const TTL = FMP_FUNDAMENTAL_CACHE_TTL_SECONDS;
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
 * **두 경로 모두 이 필터를 거쳐야 한다.** enrich 경로(`getStockPeers`)만 고치면 402는
 * 멎지만 화면에 보이는 표는 raw 경로(`getStockPeersRaw`)에서 오므로 죽은 링크가 그대로
 * 남는다. 그래서 raw 경로가 이 필터를 부르고, enrich 경로는 raw 경로의 결과를 재사용한다.
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

/**
 * 재무제표 캐시에서 최신 연간 행을 꺼내는 출처 — `CachedFinancialStatementsProvider`가 구현한다.
 *
 * FMP 경로에서 펀더멘털 탭의 현금흐름·성장률은 재무제표 탭이 이미 받아 둔 연간 응답의 첫
 * 행과 같은 데이터다. 이걸 주입하면 두 탭이 FMP 응답 하나와 Redis 키 하나를 함께 쓴다.
 * 출처는 FMP 장애를 throw해야 한다(빈 값으로 삼키면 장애가 "데이터 없음"으로 캐싱된다).
 */
export interface LatestAnnualStatementsSource {
    getLatestAnnualCashFlow(symbol: string): Promise<CashFlowRow | null>;
    getLatestAnnualIncomeGrowth(
        symbol: string
    ): Promise<IncomeGrowthRow | null>;
}

export class CachedFundamentalProvider implements FundamentalProviderWithRawPeers {
    /**
     * @param annualStatements 주면 `getCashFlowStatement`·`getIncomeStatementGrowth`를 여기서
     *   꺼낸다. yahoo 경로는 두 값이 이미 다른 펀더멘털과 한 응답(`getYahooFundamentals`)에서
     *   나오므로 주지 않고, 종전처럼 inner + 자체 키를 쓴다.
     */
    constructor(
        private readonly inner: FundamentalProvider,
        private readonly annualStatements: LatestAnnualStatementsSource | null = null
    ) {}

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
                this.fetchValuationPair(symbol, 'key-metrics')
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
                this.fetchValuationPair(symbol, 'ratios')
            ).catch(error => {
                console.error(
                    '[CachedFundamentalProvider] ratios fetch failed (not cached):',
                    error
                );
                return null;
            })
    );

    /**
     * key-metrics-ttm + ratios-ttm은 FMP에서 항상 쌍으로 온다(inner가 한 번의 상류 쌍
     * 호출로 둘을 내준다). 그런데 두 Redis 키는 독립이라, 한쪽 miss가 쌍 전체를 받아
     * 놓고 절반만 저장하면 다른 쪽이 나중에 또 miss해 같은 쌍을 FMP에서 다시 받는다.
     * 그래서 요청한 쪽은 `getOrSetCache`가 평소대로 저장하고, 형제 키는 여기서 같은
     * 쌍으로 함께 쓴다(`setCacheValue` — `getOrSetCache`가 읽는 envelope과 같은 포맷).
     *
     * 형제 키가 이미 있는지는 읽어 보지 않고 그냥 덮어쓴다. 같은 시점에 받은 신선한
     * 쌍이라 덮어써도 해가 없고, 존재 확인은 Redis 왕복만 늘린다(TTL이 서로 어긋난
     * 채 만료되는 상황은 오히려 이 덮어쓰기가 정렬해 준다).
     *
     * 쌍의 한쪽이라도 throw하면 둘 다 throw한다(`Promise.all`) — 아무것도 쓰지 않고
     * 호출부의 `.catch`가 로깅·graceful null을 맡는 기존 계약 그대로다. 정상 null(빈
     * 200)은 두 키 모두에 캐싱된다. 형제 쓰기 실패는 `setCacheValue`가 삼킨다.
     */
    private async fetchValuationPair(
        symbol: string,
        requested: 'key-metrics'
    ): Promise<FundamentalValuationMetrics | null>;
    private async fetchValuationPair(
        symbol: string,
        requested: 'ratios'
    ): Promise<FundamentalRatiosInput | null>;
    private async fetchValuationPair(
        symbol: string,
        requested: 'key-metrics' | 'ratios'
    ): Promise<FundamentalValuationMetrics | FundamentalRatiosInput | null> {
        const [keyMetrics, ratios] = await Promise.all([
            this.inner.getKeyMetricsTtm(symbol),
            this.inner.getRatiosTtm(symbol),
        ]);
        if (requested === 'key-metrics') {
            await setCacheValue(
                `fundamental:ratios:${sym(symbol)}`,
                ratios,
                TTL
            );
            return keyMetrics;
        }
        await setCacheValue(
            `fundamental:key-metrics:${sym(symbol)}`,
            keyMetrics,
            TTL
        );
        return ratios;
    }

    getCashFlowStatement = cache(
        async (symbol: string): Promise<FundamentalCashFlowInput | null> => {
            if (this.annualStatements === null) {
                return getOrSetCache(
                    `fundamental:cash-flow:${sym(symbol)}`,
                    TTL,
                    () => this.inner.getCashFlowStatement(symbol)
                );
            }
            const row =
                await this.annualStatements.getLatestAnnualCashFlow(symbol);
            return row === null
                ? null
                : {
                      operatingCashFlow: row.operatingCashFlow,
                      reportedCurrency: row.reportedCurrency,
                  };
        }
    );

    getIncomeStatementGrowth = cache(
        async (symbol: string): Promise<FundamentalGrowthInput | null> => {
            if (this.annualStatements === null) {
                return getOrSetCache(
                    `fundamental:growth:${sym(symbol)}`,
                    TTL,
                    () => this.inner.getIncomeStatementGrowth(symbol)
                );
            }
            const row =
                await this.annualStatements.getLatestAnnualIncomeGrowth(symbol);
            return row === null
                ? null
                : {
                      growthRevenue: row.growthRevenue,
                      growthEPS: row.growthEPS,
                  };
        }
    );

    getFinancialScores = cache(
        (symbol: string): Promise<FundamentalFinancialScoresInput | null> =>
            getOrSetCache(`fundamental:scores:${sym(symbol)}`, TTL, () =>
                this.inner.getFinancialScores(symbol)
            )
    );

    getAnalystEstimates = cache(
        (symbol: string): Promise<FundamentalAnalystEstimateInput | null> =>
            // `v2`: the provider now picks the fiscal year in progress instead
            // of FMP's first (five-years-ahead) row; a new key keeps rows
            // cached under the old selection from being served after deploy.
            getOrSetCache(`fundamental:estimates:v2:${sym(symbol)}`, TTL, () =>
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
     * 목록은 화면용 `getStockPeersRaw`(이미 `serveablePeers`로 거른 목록)를 재사용한다 —
     * 402와 죽은 링크의 원인이 거기서 걸러지고, 같은 FMP `stock-peers` 응답을 두 Redis
     * 키가 따로 받아 오지 않는다.
     */
    getStockPeers = cache((symbol: string): Promise<FundamentalPeerInput[]> =>
        getOrSetCache(`fundamental:peers:${sym(symbol)}`, TTL, async () => {
            const peers = await this.getStockPeersRaw(symbol);
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
