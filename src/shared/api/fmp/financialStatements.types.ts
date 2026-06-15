/** FMP /income-statement raw row (subset consumed by the adapter). */
export interface RawFmpIncomeStatement {
    fiscalYear?: string;
    period?: string;
    date?: string;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    ebitda?: number;
    eps?: number;
    epsDiluted?: number;
}

/** FMP /balance-sheet-statement raw row (subset consumed by the adapter). */
export interface RawFmpBalanceSheet {
    fiscalYear?: string;
    period?: string;
    date?: string;
    totalAssets?: number;
    totalCurrentAssets?: number;
    totalLiabilities?: number;
    totalCurrentLiabilities?: number;
    cashAndShortTermInvestments?: number;
    totalDebt?: number;
    netDebt?: number;
    totalStockholdersEquity?: number;
}

/** FMP /cash-flow-statement raw row (subset consumed by the adapter). */
export interface RawFmpCashFlow {
    fiscalYear?: string;
    period?: string;
    date?: string;
    operatingCashFlow?: number;
    capitalExpenditure?: number;
    freeCashFlow?: number;
    dividendsPaid?: number;
}

/**
 * FMP /income-statement-growth raw row.
 *
 * Note: these fields come from the `/income-statement-growth` endpoint,
 * distinct from the TTM `RawFmpIncomeGrowth` in types.ts which serves
 * the fundamental overview feature.
 */
export interface RawFmpIncomeGrowth {
    fiscalYear?: string;
    period?: string;
    growthRevenue?: number;
    growthNetIncome?: number;
    growthEPS?: number;
    growthOperatingIncome?: number;
}

/**
 * FMP /financial-growth raw row.
 *
 * `epsgrowth` is intentionally lowercase — this is the literal FMP wire
 * field name. The adapter maps it to the domain's `epsGrowth` (camelCase).
 */
export interface RawFmpFinancialGrowth {
    fiscalYear?: string;
    period?: string;
    revenueGrowth?: number;
    netIncomeGrowth?: number;
    /** FMP wire field: lowercase as returned by the API. Adapter maps → epsGrowth. */
    epsgrowth?: number;
    freeCashFlowGrowth?: number;
    operatingCashFlowGrowth?: number;
    assetGrowth?: number;
    debtGrowth?: number;
    threeYRevenueGrowthPerShare?: number;
    fiveYRevenueGrowthPerShare?: number;
    tenYRevenueGrowthPerShare?: number;
}

/** FMP /cash-flow-statement-growth raw row (subset consumed by the adapter). */
export interface RawFmpCashFlowGrowth {
    fiscalYear?: string;
    period?: string;
    growthOperatingCashFlow?: number;
    growthFreeCashFlow?: number;
    growthCapitalExpenditure?: number;
}
