// FMP-specific raw response shapes — internal to infrastructure/fmp/ only; mirrors siglens-core Raw* shapes for local extension.

/** Raw FMP company profile. `mktCap` must be mapped → `marketCap`. */
export interface RawFmpProfile {
    symbol: string;
    companyName: string;
    sector: string;
    industry: string;
    /** FMP-specific field; adapters must map to `FundamentalProfileInput.marketCap`. */
    mktCap: number;
    ceo: string | null;
    website: string | null;
    description: string | null;
}

/** Raw FMP TTM key metrics (valuation multiples). */
export interface RawFmpKeyMetricsTtm {
    peRatioTTM: number | null;
    priceToSalesRatioTTM: number | null;
    pbRatioTTM: number | null;
    pegRatioTTM: number | null;
    enterpriseValueOverEBITDATTM: number | null;
    epsTTM: number | null;
}

/** Raw FMP TTM ratios (profitability + health). */
export interface RawFmpRatiosTtm {
    returnOnEquityTTM: number | null;
    returnOnAssetsTTM: number | null;
    operatingProfitMarginTTM: number | null;
    netProfitMarginTTM: number | null;
    debtRatioTTM: number | null;
    currentRatioTTM: number | null;
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
    marketCap: number;
}

/** Raw FMP analyst estimate (next-quarter averages). */
export interface RawFmpAnalystEstimate {
    estimatedEpsAvg: number | null;
    estimatedRevenueAvg: number | null;
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

/** Single lookback-window slice of {@link RawFmpPriceTargetSummary}. */
interface RawFmpPriceTargetPeriod {
    avgPriceTarget: number | null;
}

/** Raw FMP price target summary (grouped by lookback window). */
export interface RawFmpPriceTargetSummary {
    lastMonth: RawFmpPriceTargetPeriod;
    lastQuarter: RawFmpPriceTargetPeriod;
    lastYear: RawFmpPriceTargetPeriod;
}

/** Raw FMP sector performance snapshot (one entry per sector per date). */
export interface RawFmpSectorPerformance {
    sector: string;
    changesPercentage: number;
}

/** Raw FMP historical sector performance entry (one row per date per sector). */
export interface RawFmpHistoricalSectorPerformance {
    date: string;
    sector: string;
    changesPercentage: number;
}

/** Raw FMP cash flow statement (operating cash flow subset). */
export interface RawFmpCashFlowStatement {
    operatingCashFlow: number | null;
}

/** Raw FMP earnings report for a symbol. */
export interface RawFmpEarningsReport {
    symbol: string;
    earningsDate: string;
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
    eps: number | null;
    epsEstimated: number | null;
    revenue: number | null;
    revenueEstimated: number | null;
    updatedFromDate: string;
}
