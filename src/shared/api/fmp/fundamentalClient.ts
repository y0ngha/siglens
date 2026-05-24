import { fmpGet } from './httpClient';
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

async function getOptionalArray<T>(
    path: string,
    query: Record<string, string>
): Promise<T[]> {
    try {
        return await fmpGet<T[]>(path, query);
    } catch {
        return [];
    }
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

    /** Fetch TTM key metrics (valuation multiples + EPS); returns `null` when unavailable. */
    async getKeyMetricsTtm(
        symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        const [arr, ratiosArr] = await Promise.all([
            getOptionalArray<RawFmpKeyMetricsTtm>('key-metrics-ttm', {
                symbol,
            }),
            getOptionalArray<RawFmpRatiosTtm>('ratios-ttm', { symbol }),
        ]);
        const metrics = arr[0] ?? null;
        const ratios = ratiosArr[0] ?? null;
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
        const [arr, metricsArr] = await Promise.all([
            getOptionalArray<RawFmpRatiosTtm>('ratios-ttm', { symbol }),
            getOptionalArray<RawFmpKeyMetricsTtm>('key-metrics-ttm', {
                symbol,
            }),
        ]);
        const ratios = arr[0] ?? null;
        const metrics = metricsArr[0] ?? null;
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
        const arr = await fmpGet<RawFmpEarningsReport[]>('earnings', {
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
