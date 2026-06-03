import { fmpGet as fmpGetRaw } from './httpClient';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import type {
    RawFmpAnalystEstimate,
    RawFmpCashFlowStatement,
    RawFmpEarningsReport,
    RawFmpFinancialScore,
    RawFmpGradesConsensus,
    RawFmpGradesEvent,
    RawFmpIncomeGrowth,
    RawFmpKeyMetricsTtm,
    RawFmpPriceTargetConsensus,
    RawFmpPriceTargetSummary,
    RawFmpProfile,
    RawFmpRatiosTtm,
    RawFmpSectorPerformance,
    RawFmpStockPeer,
} from './types';
import type {
    EarningsReport,
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalDataProvider,
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
    GradesAction,
    GradesEvent,
} from '@y0ngha/siglens-core';

/**
 * 펀더멘털 데이터는 장중에도 거의 불변 → 1시간 freshness 창. Next Data Cache
 * `revalidate`와 호출부의 Redis TTL이 이 단일 상수를 공유해, 두 캐시 계층의
 * 신선도가 절대 어긋나지 않는다.
 */
export const FMP_FUNDAMENTAL_REVALIDATE_SECONDS = SECONDS_PER_HOUR;

function fmpGet<T>(
    path: string,
    query: Record<string, string> = {}
): Promise<T> {
    return fmpGetRaw<T>(path, query, {
        revalidate: FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
    });
}

const ANALYST_ESTIMATES_PERIOD = 'annual';
const ANALYST_ESTIMATES_PAGE = '0';
const ANALYST_ESTIMATES_LIMIT = '10';
const EARNINGS_REPORT_LIMIT = 5;

export interface FmpEarningsReportItem {
    symbol: string;
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string | null;
    rawPayload: RawFmpEarningsReport;
}

const GRADES_ACTION_MAP: Record<string, GradesAction> = {
    upgrade: 'upgrade',
    downgrade: 'downgrade',
    maintained: 'maintained',
    reiterated: 'maintained',
    initiated: 'initiated',
    'initiated coverage': 'initiated',
};

/** Map a FMP action string to the domain `GradesAction` union; unknown strings fall back to `'other'`. */
function toGradesAction(raw: string): GradesAction {
    return GRADES_ACTION_MAP[raw.toLowerCase()] ?? 'other';
}

function toFiniteNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toEarningsDate(value: RawFmpEarningsReport): string | null {
    return typeof value.date === 'string'
        ? value.date
        : typeof value.earningsDate === 'string'
          ? value.earningsDate
          : null;
}

/** FMP adapter implementing `FundamentalDataProvider`. Uses `fmpGet` for all HTTP calls. */
export class FmpFundamentalClient implements FundamentalDataProvider {
    /** Fetch company profile; returns `null` when FMP returns an empty array. */
    async getProfile(symbol: string): Promise<FundamentalProfile | null> {
        const arr = await fmpGet<RawFmpProfile[]>('profile', { symbol });
        const r = arr[0];
        if (!r) return null;
        const marketCap = toFiniteNumber(r.marketCap ?? r.mktCap);
        if (marketCap === null) return null;
        return {
            symbol: r.symbol,
            companyName: r.companyName,
            sector: r.sector,
            industry: r.industry,
            marketCap,
            ceo: r.ceo,
            website: r.website,
            description: r.description,
        };
    }

    /**
     * 진행 중인 valuation fetch를 심볼별로 공유하는 in-flight 메모이즈 맵.
     * 완료(성공·실패) 시 finally로 제거하므로 누수 없이 "같은 요청에서 동시에
     * 들어온 호출"만 합쳐진다. cross-request 캐싱은 CachedFundamentalProvider(Redis)가
     * 담당한다.
     */
    private valuationInflight = new Map<
        string,
        Promise<{
            metrics: RawFmpKeyMetricsTtm | null;
            ratios: RawFmpRatiosTtm | null;
        }>
    >();

    /**
     * key-metrics-ttm + ratios-ttm을 한 번에 fetch해 raw 쌍을 반환한다.
     * getKeyMetricsTtm과 getRatiosTtm이 같은 요청에서 동시에 호출돼도(core의
     * Promise.all) in-flight 공유로 각 엔드포인트 fetch가 1회로 수렴한다. React.cache는
     * RSC 렌더 스코프 전용이라 Server Action(분석 경로)에서는 dedup되지 않으므로
     * 인스턴스 in-flight 맵을 쓴다. Next Data Cache(fmpGet revalidate)는 cross-request
     * 2차 방어선이지만 region/배포마다 초기화되므로 신선도 보장에 의존하지 않는다.
     *
     * FMP 장애(429/5xx/timeout)는 `fmpGet`을 통해 그대로 throw된다 — 다른 9개
     * 메서드와 동일한 계약. 이전엔 `getOptionalArray`로 에러를 `[]`로 삼켜 null을
     * 반환했는데, 그 null이 Redis 데코레이터(CachedFundamentalProvider)에 1h TTL로
     * 캐싱돼 일시적 blip이 "valuation 데이터 없음"으로 fleet-wide 고정되는 cache
     * poisoning 버그가 있었다. 이제 throw가 전파되므로 getOrSetCache가 장애 결과를
     * 캐싱하지 못한다(빈 200 → `[]` → null 캐싱은 정상 동작으로 유지). 데코레이터가
     * 이 throw를 catch해 graceful null로 변환하는 책임을 진다.
     */
    private getValuationRaw(symbol: string): Promise<{
        metrics: RawFmpKeyMetricsTtm | null;
        ratios: RawFmpRatiosTtm | null;
    }> {
        const inflight = this.valuationInflight.get(symbol);
        if (inflight !== undefined) return inflight;

        const pending = (async () => {
            const [metricsArr, ratiosArr] = await Promise.all([
                fmpGet<RawFmpKeyMetricsTtm[]>('key-metrics-ttm', { symbol }),
                fmpGet<RawFmpRatiosTtm[]>('ratios-ttm', { symbol }),
            ]);
            return {
                metrics: metricsArr[0] ?? null,
                ratios: ratiosArr[0] ?? null,
            };
        })();

        this.valuationInflight.set(symbol, pending);
        // 정리(in-flight 제거)는 성공·실패 모두에서 수행한다. `pending`이 reject되면
        // 이 derived 체인도 reject되는데, 호출부는 반환된 `pending`을 직접 await/catch하지
        // 이 정리 체인을 관찰하지 않으므로 .catch(() => {})로 별도 흡수해 unhandled
        // rejection을 막는다(실제 에러는 호출부가 그대로 받는다).
        void pending
            .finally(() => this.valuationInflight.delete(symbol))
            .catch(() => {});
        return pending;
    }

    /** Fetch TTM key metrics (valuation multiples + EPS); returns `null` when unavailable. */
    async getKeyMetricsTtm(
        symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        const { metrics, ratios } = await this.getValuationRaw(symbol);
        if (metrics === null && ratios === null) return null;
        return {
            peRatioTTM: toFiniteNumber(
                ratios?.priceToEarningsRatioTTM ?? metrics?.peRatioTTM
            ),
            priceToSalesRatioTTM: toFiniteNumber(
                ratios?.priceToSalesRatioTTM ?? metrics?.priceToSalesRatioTTM
            ),
            pbRatioTTM: toFiniteNumber(
                ratios?.priceToBookRatioTTM ?? metrics?.pbRatioTTM
            ),
            pegRatioTTM: toFiniteNumber(
                ratios?.priceToEarningsGrowthRatioTTM ?? metrics?.pegRatioTTM
            ),
            enterpriseValueOverEBITDATTM: toFiniteNumber(
                metrics?.evToEBITDATTM ??
                    ratios?.enterpriseValueMultipleTTM ??
                    metrics?.enterpriseValueOverEBITDATTM
            ),
            epsTTM: toFiniteNumber(
                ratios?.netIncomePerShareTTM ?? metrics?.epsTTM
            ),
        };
    }

    /** Fetch TTM profitability and financial health ratios; returns `null` when unavailable. */
    async getRatiosTtm(symbol: string): Promise<FundamentalRatiosInput | null> {
        const { metrics, ratios } = await this.getValuationRaw(symbol);
        if (ratios === null && metrics === null) return null;
        return {
            returnOnEquityTTM: toFiniteNumber(
                metrics?.returnOnEquityTTM ?? ratios?.returnOnEquityTTM
            ),
            returnOnAssetsTTM: toFiniteNumber(
                metrics?.returnOnAssetsTTM ?? ratios?.returnOnAssetsTTM
            ),
            operatingProfitMarginTTM: toFiniteNumber(
                ratios?.operatingProfitMarginTTM
            ),
            netProfitMarginTTM: toFiniteNumber(ratios?.netProfitMarginTTM),
            debtRatioTTM: toFiniteNumber(
                ratios?.debtToAssetsRatioTTM ?? ratios?.debtRatioTTM
            ),
            currentRatioTTM: toFiniteNumber(
                ratios?.currentRatioTTM ?? metrics?.currentRatioTTM
            ),
        };
    }

    /** Fetch the latest annual cash flow statement (operating cash flow subset); returns `null` when unavailable. */
    async getCashFlowStatement(
        symbol: string
    ): Promise<FundamentalCashFlowInput | null> {
        const arr = await fmpGet<RawFmpCashFlowStatement[]>(
            'cash-flow-statement',
            { symbol }
        );
        const r = arr[0];
        if (!r) return null;
        return { operatingCashFlow: toFiniteNumber(r.operatingCashFlow) };
    }

    /** Fetch YoY income statement growth (revenue + EPS); returns `null` when unavailable. */
    async getIncomeStatementGrowth(
        symbol: string
    ): Promise<FundamentalGrowthInput | null> {
        const arr = await fmpGet<RawFmpIncomeGrowth[]>(
            'income-statement-growth',
            { symbol }
        );
        const r = arr[0];
        if (!r) return null;
        return {
            growthRevenue: toFiniteNumber(r.growthRevenue),
            growthEPS: toFiniteNumber(r.growthEPS),
        };
    }

    /** Fetch Altman Z-score and Piotroski F-score; returns `null` when unavailable. */
    async getFinancialScores(
        symbol: string
    ): Promise<FundamentalFinancialScoresInput | null> {
        const arr = await fmpGet<RawFmpFinancialScore[]>('financial-scores', {
            symbol,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            altmanZScore: toFiniteNumber(r.altmanZScore),
            piotroskiScore: toFiniteNumber(r.piotroskiScore),
        };
    }

    /** Fetch the peer list for relative valuation context; returns an empty array when unavailable. */
    async getStockPeers(symbol: string): Promise<FundamentalPeerInput[]> {
        const arr = await fmpGet<RawFmpStockPeer[]>('stock-peers', { symbol });
        return arr.flatMap(r => {
            const marketCap = toFiniteNumber(r.marketCap ?? r.mktCap);
            return marketCap === null
                ? []
                : [
                      {
                          symbol: r.symbol,
                          companyName: r.companyName,
                          marketCap,
                      },
                  ];
        });
    }

    /** Fetch annual analyst EPS + revenue consensus estimates; returns `null` when unavailable. */
    async getAnalystEstimates(
        symbol: string
    ): Promise<FundamentalAnalystEstimateInput | null> {
        const arr = await fmpGet<RawFmpAnalystEstimate[]>('analyst-estimates', {
            symbol,
            period: ANALYST_ESTIMATES_PERIOD,
            page: ANALYST_ESTIMATES_PAGE,
            limit: ANALYST_ESTIMATES_LIMIT,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            estimatedEpsAvg: toFiniteNumber(r.epsAvg ?? r.estimatedEpsAvg),
            estimatedRevenueAvg: toFiniteNumber(
                r.revenueAvg ?? r.estimatedRevenueAvg
            ),
        };
    }

    /** Fetch recent analyst grade-change events; returns events sorted descending by date. */
    async getGrades(symbol: string): Promise<GradesEvent[]> {
        const arr = await fmpGet<RawFmpGradesEvent[]>('grades', {
            symbol,
        });
        return arr.map(r => ({
            symbol: r.symbol,
            date: r.date,
            gradingCompany: r.gradingCompany,
            previousGrade: r.previousGrade,
            newGrade: r.newGrade,
            action: toGradesAction(r.action),
        }));
    }

    /** Fetch the current buy/hold/sell grade consensus breakdown; returns `null` when unavailable. */
    async getGradesConsensus(
        symbol: string
    ): Promise<FundamentalGradesConsensusInput | null> {
        const arr = await fmpGet<RawFmpGradesConsensus[]>('grades-consensus', {
            symbol,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            strongBuy: r.strongBuy,
            buy: r.buy,
            hold: r.hold,
            sell: r.sell,
            strongSell: r.strongSell,
        };
    }

    /** Fetch analyst price target consensus (high / low / median / mean); returns `null` when unavailable. */
    async getPriceTargetConsensus(
        symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> {
        const arr = await fmpGet<RawFmpPriceTargetConsensus[]>(
            'price-target-consensus',
            { symbol }
        );
        const r = arr[0];
        if (!r) return null;
        return {
            targetHigh: toFiniteNumber(r.targetHigh),
            targetLow: toFiniteNumber(r.targetLow),
            targetMedian: toFiniteNumber(r.targetMedian),
            targetConsensus: toFiniteNumber(r.targetConsensus),
        };
    }

    /** Fetch rolling average price targets (1-month, 3-month, 12-month); returns `null` when unavailable. */
    async getPriceTargetSummary(
        symbol: string
    ): Promise<FundamentalPriceTargetSummaryInput | null> {
        const arr = await fmpGet<RawFmpPriceTargetSummary[]>(
            'price-target-summary',
            { symbol }
        );
        const r = arr[0];
        if (!r) return null;
        return {
            lastMonth: {
                avgPriceTarget: toFiniteNumber(r.lastMonthAvgPriceTarget),
            },
            lastQuarter: {
                avgPriceTarget: toFiniteNumber(r.lastQuarterAvgPriceTarget),
            },
            lastYear: {
                avgPriceTarget: toFiniteNumber(r.lastYearAvgPriceTarget),
            },
        };
    }

    /** Fetch sector performance for `date` (YYYY-MM-DD); returns domain-neutral entries. */
    async getSectorPerformanceSnapshot(
        date: string
    ): Promise<FundamentalSectorPerformanceInput[]> {
        const arr = await fmpGet<RawFmpSectorPerformance[]>(
            'sector-performance-snapshot',
            { date }
        );
        return arr.flatMap(r => {
            const changesPercentage = toFiniteNumber(
                r.averageChange ?? r.changesPercentage
            );
            return changesPercentage === null
                ? []
                : [{ sector: r.sector, changesPercentage }];
        });
    }

    /** FMP historical-sector-performance data is unreliable on the current plan (returns stale dates). Stub returns empty so core omits sectorHistorical from the AI prompt. */
    async getHistoricalSectorPerformance(
        _sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> {
        return [];
    }

    /** Fetch the latest earnings report for a symbol; returns `null` when unavailable. */
    async getEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const arr = await this.getEarningsReports(symbol, 1);
        const r = arr[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            earningsDate: r.earningsDate,
        };
    }

    /** Fetch recent/upcoming earnings rows for news-page comparison; default limit keeps payload small. */
    async getEarningsReports(
        symbol: string,
        limit = EARNINGS_REPORT_LIMIT
    ): Promise<FmpEarningsReportItem[]> {
        // earnings는 실적 발표 시점 실시간성이 중요 → 1h 캐시 대신 no-store(fmpGetRaw).
        const arr = await fmpGetRaw<RawFmpEarningsReport[]>('earnings', {
            symbol,
            limit: String(limit),
        });

        return arr.flatMap(toFmpEarningsReportItem);
    }
}

function toFmpEarningsReportItem(
    raw: RawFmpEarningsReport
): FmpEarningsReportItem[] {
    const earningsDate = toEarningsDate(raw);
    if (earningsDate === null) return [];

    return [
        {
            symbol: raw.symbol,
            earningsDate,
            epsActual: toFiniteNumber(raw.epsActual ?? raw.eps),
            epsEstimated: toFiniteNumber(raw.epsEstimated),
            revenueActual: toFiniteNumber(raw.revenueActual ?? raw.revenue),
            revenueEstimated: toFiniteNumber(raw.revenueEstimated),
            lastUpdated:
                typeof raw.lastUpdated === 'string' ? raw.lastUpdated : null,
            rawPayload: raw,
        },
    ];
}
