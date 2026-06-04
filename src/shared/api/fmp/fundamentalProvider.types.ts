import type { FundamentalDataProvider } from '@y0ngha/siglens-core';
import type { FmpEarningsReportItem } from './fundamentalClient';

/**
 * App-facing fundamental provider surface: the core `FundamentalDataProvider`
 * port plus the two siglens-specific extras that some injection points call
 * directly (`getGrades` is widened from the port's optional method to required,
 * and `getEarningsReports` is not on the port at all). Both the real
 * `FmpFundamentalClient` and the E2E `FakeFundamentalDataProvider` satisfy it.
 *
 * Lives in its own module (not `getFundamentalDataProvider.ts`) so the
 * `CachedFundamentalProvider` class can `import type` it without forming a
 * type-level cycle with `getFundamentalDataProvider.ts` (which imports the
 * `CachedFundamentalProvider` class at runtime).
 */
export interface FundamentalProvider extends FundamentalDataProvider {
    getGrades: NonNullable<FundamentalDataProvider['getGrades']>;
    getEarningsReports(
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]>;
}
