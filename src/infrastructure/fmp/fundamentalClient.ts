/**
 * FMP implementation of `FundamentalDataProvider`.
 *
 * Each method fetches from a FMP `/stable/*` endpoint and maps the FMP raw
 * response shape to the domain-neutral input type expected by
 * `normalizeFundamentalSnapshot` (and other siglens-core use-cases).
 *
 * Field-name mapping decisions (FMP → domain):
 * - `mktCap`              → `marketCap`           (getProfile)
 * - `targetHigh/Low/…`   → `targetHigh/Low/…`     (getPriceTargetConsensus — identical)
 * - `lastMonth/Quarter/…` → `lastMonth/Quarter/…` (getPriceTargetSummary — identical)
 * - `changesPercentage`   → `changesPercentage`    (sector endpoints — identical)
 * - Grades action strings are normalised to `GradesAction` union via `toGradesAction`.
 */
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
    FundamentalProfileInput,
    FundamentalRatiosInput,
    FundamentalSectorHistoricalInput,
    FundamentalSectorPerformanceInput,
    FundamentalValuationMetrics,
    GradesAction,
    GradesEvent,
} from '@y0ngha/siglens-core';
import { fmpGet } from '@/infrastructure/fmp/httpClient';
import type {
    RawFmpAnalystEstimate,
    RawFmpCashFlowStatement,
    RawFmpEarningsReport,
    RawFmpFinancialScore,
    RawFmpGradesConsensus,
    RawFmpGradesEvent,
    RawFmpHistoricalSectorPerformance,
    RawFmpIncomeGrowth,
    RawFmpKeyMetricsTtm,
    RawFmpPriceTargetConsensus,
    RawFmpPriceTargetSummary,
    RawFmpProfile,
    RawFmpRatiosTtm,
    RawFmpSectorPerformance,
    RawFmpStockPeer,
} from '@/infrastructure/fmp/types';

/** Default number of recent grading events returned by `getGrades`. */
export const DEFAULT_GRADES_LIMIT = 10;

/** @internal Map a FMP action string to the domain `GradesAction` union; unknown strings fall back to `'other'`. */
function toGradesAction(raw: string): GradesAction {
    const lower = raw.toLowerCase();
    if (lower === 'upgrade') return 'upgrade';
    if (lower === 'downgrade') return 'downgrade';
    if (lower === 'maintained' || lower === 'reiterated') return 'maintained';
    if (lower === 'initiated' || lower === 'initiated coverage')
        return 'initiated';
    return 'other';
}

/**
 * FMP adapter implementing `FundamentalDataProvider`.
 *
 * Uses the shared `fmpGet` helper (see `httpClient.ts`) for all HTTP calls.
 * All methods map the FMP raw response shapes to domain-neutral input types
 * before returning — the adapter is the boundary responsible for this translation.
 */
export class FmpFundamentalClient implements FundamentalDataProvider {
    /** Fetch company profile and map `mktCap` → `marketCap`; returns `null` when FMP returns an empty array. */
    async getProfile(symbol: string): Promise<FundamentalProfileInput | null> {
        const arr = await fmpGet<RawFmpProfile[]>('profile', { symbol });
        const r = arr[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            companyName: r.companyName,
            sector: r.sector,
            industry: r.industry,
            marketCap: r.mktCap, // FMP: mktCap → domain: marketCap
            ceo: r.ceo,
            website: r.website,
            description: r.description,
        };
    }

    /** Fetch TTM key metrics (valuation multiples + EPS); returns `null` when unavailable. */
    async getKeyMetricsTtm(
        symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        const arr = await fmpGet<RawFmpKeyMetricsTtm[]>('key-metrics-ttm', {
            symbol,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            peRatioTTM: r.peRatioTTM,
            priceToSalesRatioTTM: r.priceToSalesRatioTTM,
            pbRatioTTM: r.pbRatioTTM,
            pegRatioTTM: r.pegRatioTTM,
            enterpriseValueOverEBITDATTM: r.enterpriseValueOverEBITDATTM,
            epsTTM: r.epsTTM,
        };
    }

    /** Fetch TTM profitability and financial health ratios; returns `null` when unavailable. */
    async getRatiosTtm(symbol: string): Promise<FundamentalRatiosInput | null> {
        const arr = await fmpGet<RawFmpRatiosTtm[]>('ratios-ttm', { symbol });
        const r = arr[0];
        if (!r) return null;
        return {
            returnOnEquityTTM: r.returnOnEquityTTM,
            returnOnAssetsTTM: r.returnOnAssetsTTM,
            operatingProfitMarginTTM: r.operatingProfitMarginTTM,
            netProfitMarginTTM: r.netProfitMarginTTM,
            debtRatioTTM: r.debtRatioTTM,
            currentRatioTTM: r.currentRatioTTM,
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
        return { operatingCashFlow: r.operatingCashFlow };
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
            growthRevenue: r.growthRevenue,
            growthEPS: r.growthEPS,
        };
    }

    /** Fetch Altman Z-score and Piotroski F-score; returns `null` when unavailable. */
    async getFinancialScores(
        symbol: string
    ): Promise<FundamentalFinancialScoresInput | null> {
        const arr = await fmpGet<RawFmpFinancialScore[]>('score', { symbol });
        const r = arr[0];
        if (!r) return null;
        return {
            altmanZScore: r.altmanZScore,
            piotroskiScore: r.piotroskiScore,
        };
    }

    /** Fetch the peer list for relative valuation context; returns an empty array when unavailable. */
    async getStockPeers(symbol: string): Promise<FundamentalPeerInput[]> {
        const arr = await fmpGet<RawFmpStockPeer[]>('stock-peers', { symbol });
        return arr.map(r => ({
            symbol: r.symbol,
            companyName: r.companyName,
            marketCap: r.marketCap,
        }));
    }

    /** Fetch next-quarter analyst EPS + revenue consensus estimates; returns `null` when unavailable. */
    async getAnalystEstimates(
        symbol: string
    ): Promise<FundamentalAnalystEstimateInput | null> {
        const arr = await fmpGet<RawFmpAnalystEstimate[]>('analyst-estimates', {
            symbol,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            estimatedEpsAvg: r.estimatedEpsAvg,
            estimatedRevenueAvg: r.estimatedRevenueAvg,
        };
    }

    /** Fetch recent analyst grade-change events; `limit` defaults to `DEFAULT_GRADES_LIMIT`; returns events sorted descending by date. */
    async getGrades(
        symbol: string,
        limit = DEFAULT_GRADES_LIMIT
    ): Promise<GradesEvent[]> {
        const arr = await fmpGet<RawFmpGradesEvent[]>('grades', {
            symbol,
            limit: String(limit),
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
            targetHigh: r.targetHigh,
            targetLow: r.targetLow,
            targetMedian: r.targetMedian,
            targetConsensus: r.targetConsensus,
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
            lastMonth: { avgPriceTarget: r.lastMonth.avgPriceTarget },
            lastQuarter: { avgPriceTarget: r.lastQuarter.avgPriceTarget },
            lastYear: { avgPriceTarget: r.lastYear.avgPriceTarget },
        };
    }

    /** Fetch sector performance for `date` (YYYY-MM-DD); returns domain-neutral entries. */
    async getSectorPerformanceSnapshot(
        date: string
    ): Promise<FundamentalSectorPerformanceInput[]> {
        const arr = await fmpGet<RawFmpSectorPerformance[]>(
            'sector-performance',
            { date }
        );
        return arr.map(r => ({
            sector: r.sector,
            changesPercentage: r.changesPercentage,
        }));
    }

    /** Fetch historical daily sector performance for `sector` (FMP sector name, e.g. `"Technology"`). */
    async getHistoricalSectorPerformance(
        sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> {
        const arr = await fmpGet<RawFmpHistoricalSectorPerformance[]>(
            'historical-sector-performance',
            {
                sector,
            }
        );
        return arr.map(r => ({
            date: r.date,
            sector: r.sector,
            changesPercentage: r.changesPercentage,
        }));
    }

    /** Fetch the latest earnings report for a symbol; returns `null` when unavailable. */
    async getEarningsReport(symbol: string): Promise<EarningsReport | null> {
        const arr = await fmpGet<RawFmpEarningsReport[]>('earnings', {
            symbol,
        });
        const r = arr[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            earningsDate: r.earningsDate,
        };
    }
}
