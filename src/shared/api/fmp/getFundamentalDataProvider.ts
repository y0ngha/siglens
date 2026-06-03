import type { FundamentalDataProvider } from '@y0ngha/siglens-core';
import {
    FmpFundamentalClient,
    type FmpEarningsReportItem,
} from './fundamentalClient';
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
import { isE2E } from '@/shared/api/e2eEnv';

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
    if (isE2E()) {
        // Sync factory — no dynamic import possible here, so the fake loads via a
        // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
        // still bundles it into the server output).
        const { FakeFundamentalDataProvider } =
            require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
        cached = new FakeFundamentalDataProvider();
        return cached;
    }
    cached = new CachedFundamentalProvider(new FmpFundamentalClient());
    return cached;
}
