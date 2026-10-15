/**
 * FMP wire rows used by Investor Flows. Every field is optional/unknown on purpose:
 * the mapper (`entities/investor-flows/lib/investorFlowsFmpMappers.ts`) validates each one, so a
 * provider-side shape change degrades a field instead of crashing the page.
 */

/** FMP `insider-trading/search` row (Form 4). */
export interface RawInsiderTrade {
    symbol?: string | null;
    filingDate?: string | null;
    transactionDate?: string | null;
    reportingCik?: string | null;
    transactionType?: string | null;
    securitiesOwned?: number | null;
    reportingName?: string | null;
    typeOfOwner?: string | null;
    acquisitionOrDisposition?: string | null;
    formType?: string | null;
    securitiesTransacted?: number | null;
    price?: number | null;
    securityName?: string | null;
    url?: string | null;
}

/** FMP `insider-trading/statistics` row — one per (year, quarter). */
export interface RawInsiderStatistic {
    symbol?: string | null;
    year?: number | null;
    quarter?: number | null;
    acquiredTransactions?: number | null;
    disposedTransactions?: number | null;
    totalAcquired?: number | null;
    totalDisposed?: number | null;
    totalPurchases?: number | null;
    totalSales?: number | null;
}

/** FMP `acquisition-of-beneficial-ownership` row (Schedule 13D/G). All numbers arrive as strings. */
export interface RawBeneficialOwnership {
    symbol?: string | null;
    /** Subject company's CIK (the issuer the filing is about). */
    cik?: string | null;
    filingDate?: string | null;
    nameOfReportingPerson?: string | null;
    amountBeneficiallyOwned?: string | null;
    percentOfClass?: string | null;
    url?: string | null;
    /**
     * Exact SEC form (`SCHEDULE 13G/A`, `SC 13D`, ...), added by the client from the subject company's SEC
     * submissions list. Absent when the accession was not found there.
     */
    form?: string | null;
    /** true when the SEC lookup itself failed (so the form may be inferred from the URL instead). */
    formLookupFailed?: boolean;
}

/** FMP `shares-float` row. */
export interface RawSharesFloat {
    symbol?: string | null;
    floatShares?: number | null;
    outstandingShares?: number | null;
}

/**
 * On-demand FMP data for the Investor Flows snapshot.
 *
 * Contract: a thrown error means FMP infrastructure failed; `[]` / `null` mean "no rows".
 * The resilient loader relies on that distinction to decide `degraded`.
 */
export interface InvestorFlowsFmpProvider {
    /** Form 4 rows filed in the last `lookbackDays` days, newest first. */
    getInsiderTrades(
        symbol: string,
        lookbackDays: number
    ): Promise<RawInsiderTrade[]>;
    getInsiderStatistics(symbol: string): Promise<RawInsiderStatistic[]>;
    getBeneficialOwnership(
        symbol: string,
        limit: number
    ): Promise<RawBeneficialOwnership[]>;
    getSharesFloat(symbol: string): Promise<RawSharesFloat | null>;
}
