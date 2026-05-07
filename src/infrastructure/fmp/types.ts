// FMP-specific raw response shapes — internal to infrastructure/fmp/ only; mirrors siglens-core Raw* shapes for local extension.

/** Raw FMP company profile. */
export interface RawFmpProfile {
    symbol: string;
    companyName: string;
    sector: string;
    industry: string;
    marketCap?: number | null;
    mktCap?: number | null;
    ceo: string | null;
    website: string | null;
    description: string | null;
}

/**
 * Raw FMP TTM key metrics (valuation multiples).
 *
 * All fields are optional because FMP may split this data across two
 * endpoints (`key-metrics-ttm` and `ratios-ttm`). Either endpoint may be
 * unavailable or partially populated for a given symbol (small caps, recent
 * IPOs, sector limitations). Runtime validation via `toFiniteNumber()` is
 * required at the call site; don't trust field presence.
 */
export interface RawFmpKeyMetricsTtm {
    peRatioTTM?: number | null;
    priceToSalesRatioTTM?: number | null;
    pbRatioTTM?: number | null;
    pegRatioTTM?: number | null;
    enterpriseValueOverEBITDATTM?: number | null;
    evToEBITDATTM?: number | null;
    epsTTM?: number | null;
    returnOnEquityTTM?: number | null;
    returnOnAssetsTTM?: number | null;
    currentRatioTTM?: number | null;
}

/**
 * Raw FMP TTM ratios (profitability + health).
 *
 * All fields are optional because FMP may split this data across two
 * endpoints (`key-metrics-ttm` and `ratios-ttm`). Either endpoint may be
 * unavailable or partially populated for a given symbol (small caps, recent
 * IPOs, sector limitations). Runtime validation via `toFiniteNumber()` is
 * required at the call site; don't trust field presence.
 */
export interface RawFmpRatiosTtm {
    returnOnEquityTTM?: number | null;
    returnOnAssetsTTM?: number | null;
    operatingProfitMarginTTM?: number | null;
    netProfitMarginTTM?: number | null;
    debtRatioTTM?: number | null;
    debtToAssetsRatioTTM?: number | null;
    currentRatioTTM?: number | null;
    priceToEarningsRatioTTM?: number | null;
    priceToSalesRatioTTM?: number | null;
    priceToBookRatioTTM?: number | null;
    priceToEarningsGrowthRatioTTM?: number | null;
    enterpriseValueMultipleTTM?: number | null;
    netIncomePerShareTTM?: number | null;
}

/** Raw FMP income statement growth (year-over-year). */
export interface RawFmpIncomeGrowth {
    growthRevenue: number | null;
    growthEPS: number | null;
}

/** Raw FMP financial scores (Altman Z-score + Piotroski F-score). */
export interface RawFmpFinancialScore {
    altmanZScore: number | null;
    piotroskiScore: number | null;
}

/** Raw FMP stock peer entry. */
export interface RawFmpStockPeer {
    symbol: string;
    companyName: string;
    marketCap?: number | null;
    mktCap?: number | null;
}

/** Raw FMP analyst estimate (annual averages). */
export interface RawFmpAnalystEstimate {
    estimatedEpsAvg?: number | null;
    epsAvg?: number | null;
    estimatedRevenueAvg?: number | null;
    revenueAvg?: number | null;
}

/** Raw FMP analyst grades (individual rating-change event). */
export interface RawFmpGradesEvent {
    symbol: string;
    date: string;
    gradingCompany: string;
    previousGrade: string | null;
    newGrade: string;
    action: string;
}

/** Raw FMP analyst grade consensus breakdown. */
export interface RawFmpGradesConsensus {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

/** Raw FMP price target consensus. */
export interface RawFmpPriceTargetConsensus {
    targetHigh: number | null;
    targetLow: number | null;
    targetMedian: number | null;
    targetConsensus: number | null;
}

/** Raw FMP price target summary. */
export interface RawFmpPriceTargetSummary {
    symbol: string;
    lastMonthCount: number;
    lastMonthAvgPriceTarget: number | null;
    lastQuarterCount: number;
    lastQuarterAvgPriceTarget: number | null;
    lastYearCount: number;
    lastYearAvgPriceTarget: number | null;
    allTimeCount: number;
    allTimeAvgPriceTarget: number | null;
    publishers: string;
}

/** Raw FMP sector performance snapshot (one entry per sector per date). */
export interface RawFmpSectorPerformance {
    sector: string;
    changesPercentage?: number | null;
    averageChange?: number | null;
}

/** Raw FMP historical sector performance entry (one row per date per sector). */
export interface RawFmpHistoricalSectorPerformance {
    date: string;
    sector: string;
    changesPercentage?: number | null;
    averageChange?: number | null;
}

/** Raw FMP cash flow statement (operating cash flow subset). */
export interface RawFmpCashFlowStatement {
    operatingCashFlow: number | null;
}

/** Raw FMP earnings report for a symbol. */
export interface RawFmpEarningsReport {
    symbol: string;
    date?: string;
    earningsDate?: string;
}

/** Raw FMP news article from `/stable/news/stock`. */
export interface RawFmpNews {
    symbol: string;
    publishedDate: string;
    title: string;
    site: string;
    text: string | null;
    url: string;
}

/** Raw FMP earnings calendar entry from `/stable/earnings-calendar`. */
export interface RawFmpEarningsCalendarItem {
    symbol: string;
    date: string;
    eps?: number | null;
    epsActual?: number | null;
    epsEstimated: number | null;
    revenue?: number | null;
    revenueActual?: number | null;
    revenueEstimated: number | null;
    updatedFromDate?: string;
    lastUpdated?: string;
}
