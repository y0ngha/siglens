import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import { FmpNewsClient } from './fmpNewsClient';

/**
 * App-facing news client surface (the methods callers depend on). `FmpNewsClient`
 * is a siglens class, not a core port, so this explicit interface names the
 * contract both the real client and `FakeNewsClient` must satisfy — mirroring the
 * `FundamentalProvider` interface in getFundamentalDataProvider.ts. Signatures
 * match `FmpNewsClient` exactly.
 */
export interface NewsClientPort {
    fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]>;
    fetchNewsForPeriod(symbol: string, lookbackMs: number): Promise<NewsItem[]>;
    fetchEarningsReport(symbol: string): Promise<EarningsReport | null>;
}

let cached: NewsClientPort | null = null;

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(): NewsClientPort {
    if (cached !== null) return cached;
    if (process.env.E2E_TEST === '1') {
        // require keeps the fake out of the production bundle.
        const { FakeNewsClient } =
            require('./FakeNewsClient') as typeof import('./FakeNewsClient');
        cached = new FakeNewsClient();
        return cached;
    }
    cached = new FmpNewsClient();
    return cached;
}
