/**
 * ⚠️ TEMPORARY LOCAL MIRROR of the `@y0ngha/siglens-core` Investor Flows contract.
 *
 * The core release that exports `InvestorFlowsDataProvider` / `InvestorFlowsSnapshot` (design §4, step 1 of
 * `docs/superpowers/specs/2026-10-15-investor-flows-design.md` §6) is not published yet, so this
 * file mirrors core's types exactly. Once core ships, DELETE this file and import the same names from
 * `@y0ngha/siglens-core` — nothing else in this repo should need to change (every consumer imports
 * these types from here on purpose, so the swap is a one-line import change per consumer).
 *
 * Mirrors `src/domain/investorFlows/types.ts` + `src/domain/ports/investorFlowsDataProvider.ts` of siglens-core
 * (snapshot + port only; the scorecard/AI types are core's). Dates are `yyyy-mm-dd` strings (`asOf` may be a full ISO instant) so the snapshot survives
 * `unstable_cache`'s JSON round trip unchanged.
 */

/** How one institutional filer's position in the symbol moved versus the prior quarter. */
export type InstitutionalHolderChangeKind =
    | 'new'
    | 'increased'
    | 'decreased'
    | 'exited'
    | 'unchanged';

/** Aggregated 13F positions in one symbol for one report quarter. */
export interface InstitutionalQuarter {
    /** Report-period end (`PERIODOFREPORT`), e.g. `2026-06-30`. */
    readonly period: string;
    /** `true` once the 13F filing deadline for `period` has passed. */
    readonly complete: boolean;
    /** Number of distinct institutions holding the symbol. */
    readonly holders: number;
    /** Total shares held by those institutions. */
    readonly shares: number;
    /** Total reported market value in USD. */
    readonly valueUsd: number;
    /** Institutions with no position in the prior quarter. */
    readonly newHolders: number;
    /** Institutions that held before and hold more now. */
    readonly increased: number;
    /** Institutions that held before and hold less now. */
    readonly decreased: number;
    /** Institutions that held before and hold nothing now. */
    readonly exited: number;
    /** Sum over all institutions of (shares now - shares prior quarter). */
    readonly netShareChange: number;
}

/** One institution's position and its change versus the prior quarter. */
export interface InstitutionalHolderChange {
    readonly filerName: string;
    readonly cik: string;
    /** Shares held in the quarter named by `topHoldersPeriod` (0 for `exited`). */
    readonly shares: number;
    readonly valueUsd: number;
    /** Shares held in the prior quarter; `null` when it held nothing then (`new`). */
    readonly prevShares: number | null;
    readonly change: InstitutionalHolderChangeKind;
}

export type InsiderTransactionType = 'buy' | 'sell' | 'other';

/** One Form 4 transaction. */
export interface InsiderTransaction {
    readonly date: string;
    readonly filingDate: string;
    readonly name: string;
    /** Free-text relationship as filed (e.g. `officer: Chief Executive Officer`, `director`). */
    readonly role: string;
    /** FMP `P-Purchase` → buy, `S-Sale` → sell, else other. */
    readonly type: InsiderTransactionType;
    readonly shares: number;
    readonly price: number | null;
    readonly value: number | null;
    /** Shares the insider owns after the transaction; `null` when not reported. */
    readonly sharesOwnedAfter: number | null;
    readonly url: string;
}

/** Optional pre-aggregated insider statistics from the provider. */
export interface InsiderStatistics {
    /** Quarter the statistics describe (`yyyy-mm-dd` quarter end). */
    readonly period: string;
    readonly acquiredTransactions: number;
    readonly disposedTransactions: number;
    readonly totalAcquired: number;
    readonly totalDisposed: number;
}

/** One Schedule 13D / 13G (5% beneficial-owner) filing. */
export interface LargeHolderFiling {
    readonly filingDate: string;
    readonly filer: string;
    /** Form as filed (`SC 13D`, `SC 13D/A`, `SCHEDULE 13G`, `SC 13G/A`, ...). */
    readonly form: string;
    readonly percentOfClass: number | null;
    readonly shares: number | null;
    readonly url: string;
}

export interface ShortInterestPoint {
    readonly settlementDate: string;
    readonly shortQty: number;
    readonly avgDailyVolume: number | null;
    readonly daysToCover: number | null;
}

/** One trading day of FINRA off-exchange (TRF-reported) short sale volume. */
export interface ShortVolumePoint {
    readonly date: string;
    readonly shortVolume: number;
    readonly totalVolume: number;
}

export interface InstitutionalSnapshot {
    /** Quarters with data, in any order; the scorecard sorts by `period`. */
    readonly quarters: readonly InstitutionalQuarter[];
    /** Largest holders, largest position first, relative to the quarter named by `topHoldersPeriod`. */
    readonly topHolders: readonly InstitutionalHolderChange[];
    /** Quarter `topHolders` was compared in; `null` when unknown. */
    readonly topHoldersPeriod: string | null;
}

export interface InsiderSnapshot {
    /** Roughly the last 12 months of Form 4 transactions, any order. */
    readonly transactions: readonly InsiderTransaction[];
    readonly stats?: readonly InsiderStatistics[];
}

export interface InvestorFlowsSnapshot {
    /** Reference date (ISO date or datetime; the UTC date part is used). */
    readonly asOf: string;
    readonly sharesOutstanding: number | null;
    readonly floatShares: number | null;
    readonly institutional: InstitutionalSnapshot;
    readonly insider: InsiderSnapshot;
    /** Recent 13D/13G filings (about the last 2 years); `null` when unavailable (fetch failed). */
    readonly largeHolders: readonly LargeHolderFiling[] | null;
    /** `null` when the FINRA feature flag is off. */
    readonly shortInterest: readonly ShortInterestPoint[] | null;
    /** `null` when the FINRA feature flag is off. */
    readonly shortVolume: readonly ShortVolumePoint[] | null;
}

/**
 * Port. Return `null` when the symbol has no coverage at all; throw ONLY on infrastructure failures;
 * return `shortInterest`/`shortVolume` as `null` when the FINRA flag is off.
 */
export interface InvestorFlowsDataProvider {
    getInvestorFlowsSnapshot(
        symbol: string
    ): Promise<InvestorFlowsSnapshot | null>;
}
