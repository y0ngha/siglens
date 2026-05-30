import type { FundamentalDataProvider } from '@y0ngha/siglens-core';
import {
    FmpFundamentalClient,
    type FmpEarningsReportItem,
} from './fundamentalClient';

/**
 * App-facing fundamental provider surface: the core `FundamentalDataProvider`
 * port plus the two siglens-specific extras that some injection points call
 * directly (`getGrades` is widened from the port's optional method to required,
 * and `getEarningsReports` is not on the port at all). Both the real
 * `FmpFundamentalClient` and the E2E `FakeFundamentalDataProvider` satisfy it.
 */
export interface FundamentalProvider extends FundamentalDataProvider {
    getGrades: NonNullable<FundamentalDataProvider['getGrades']>;
    getEarningsReports(
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]>;
}

let cached: FundamentalProvider | null = null;

/** Returns the app's fundamental data provider (FMP in prod, fake under E2E_TEST). */
export function getFundamentalDataProvider(): FundamentalProvider {
    if (cached !== null) return cached;
    if (process.env.E2E_TEST === '1') {
        // require keeps the fake out of the production bundle.
        const { FakeFundamentalDataProvider } =
            require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
        cached = new FakeFundamentalDataProvider();
        return cached;
    }
    cached = new FmpFundamentalClient();
    return cached;
}
