// FMP-specific raw response shapes — internal to infrastructure/fmp/ only; mirrors siglens-core Raw* shapes for local extension.

/** @internal Raw FMP company profile. `mktCap` must be mapped → `marketCap`. */
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

/** @internal Raw FMP TTM key metrics (valuation multiples). */
export interface RawFmpKeyMetricsTtm {
    peRatioTTM: number | null;
    priceToSalesRatioTTM: number | null;
    pbRatioTTM: number | null;
    pegRatioTTM: number | null;
    enterpriseValueOverEBITDATTM: number | null;
    epsTTM: number | null;
}

/** @internal Raw FMP TTM ratios (profitability + health). */
export interface RawFmpRatiosTtm {
    returnOnEquityTTM: number | null;
    returnOnAssetsTTM: number | null;
    operatingProfitMarginTTM: number | null;
    netProfitMarginTTM: number | null;
    debtRatioTTM: number | null;
    currentRatioTTM: number | null;
}

/** @internal Raw FMP income statement growth (year-over-year). */
export interface RawFmpIncomeGrowth {
    growthRevenue: number | null;
    growthEPS: number | null;
}

/** @internal Raw FMP financial scores (Altman Z-score + Piotroski F-score). */
export interface RawFmpFinancialScore {
    altmanZScore: number | null;
    piotroskiScore: number | null;
}

/** @internal Raw FMP stock peer entry. */
export interface RawFmpStockPeer {
    symbol: string;
    companyName: string;
    marketCap: number;
}

/** @internal Raw FMP analyst estimate (next-quarter averages). */
export interface RawFmpAnalystEstimate {
    estimatedEpsAvg: number | null;
    estimatedRevenueAvg: number | null;
}

/** @internal Raw FMP analyst grades (individual rating-change event). */
export interface RawFmpGradesEvent {
    symbol: string;
    date: string;
    gradingCompany: string;
    previousGrade: string | null;
    newGrade: string;
    action: string;
}

/** @internal Raw FMP analyst grade consensus breakdown. */
export interface RawFmpGradesConsensus {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

/** @internal Raw FMP price target consensus. */
export interface RawFmpPriceTargetConsensus {
    targetHigh: number | null;
    targetLow: number | null;
    targetMedian: number | null;
    targetConsensus: number | null;
}

/** @internal Raw FMP price target summary (grouped by lookback window). */
export interface RawFmpPriceTargetSummary {
    lastMonth: { avgPriceTarget: number | null };
    lastQuarter: { avgPriceTarget: number | null };
    lastYear: { avgPriceTarget: number | null };
}

/** @internal Raw FMP sector performance snapshot (one entry per sector per date). */
export interface RawFmpSectorPerformance {
    sector: string;
    changesPercentage: number;
}

/** @internal Raw FMP historical sector performance entry (one row per date per sector). */
export interface RawFmpHistoricalSectorPerformance {
    date: string;
    sector: string;
    changesPercentage: number;
}

/** @internal Raw FMP cash flow statement (operating cash flow subset). */
export interface RawFmpCashFlowStatement {
    operatingCashFlow: number | null;
}

/** @internal Raw FMP earnings report for a symbol. */
export interface RawFmpEarningsReport {
    symbol: string;
    earningsDate: string;
}

/** @internal Raw FMP news article from `/stable/news/stock`. */
export interface RawFmpNews {
    symbol: string;
    publishedDate: string;
    title: string;
    site: string;
    text: string | null;
    url: string;
}

/** @internal Raw FMP earnings calendar entry from `/stable/earnings-calendar`. */
export interface RawFmpEarningsCalendarItem {
    symbol: string;
    date: string;
    eps: number | null;
    epsEstimated: number | null;
    revenue: number | null;
    revenueEstimated: number | null;
    updatedFromDate: string;
}
