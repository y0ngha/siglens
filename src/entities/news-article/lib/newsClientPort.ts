import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';

/**
 * App-facing news client surface (the methods callers depend on). `FmpNewsClient`
 * is a siglens class, not a core port, so this explicit interface names the
 * contract both the real client and `FakeNewsClient` must satisfy — mirroring the
 * `FundamentalProvider` interface in getFundamentalDataProvider.ts. Signatures
 * match `FmpNewsClient` exactly.
 *
 * Lives in its own file (not getNewsClient.ts) so `FakeNewsClient` can import the
 * type without creating a getNewsClient ↔ FakeNewsClient import cycle.
 */
export interface NewsClientPort {
    fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]>;
    fetchNewsForPeriod(symbol: string, lookbackMs: number): Promise<NewsItem[]>;
    fetchEarningsReport(symbol: string): Promise<EarningsReport | null>;
}
