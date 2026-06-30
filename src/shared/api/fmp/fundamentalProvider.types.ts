import type {
    FundamentalDataProvider,
    FundamentalPeerInput,
} from '@y0ngha/siglens-core';
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

/**
 * 소비자(페이지·팩토리)가 받는 표면. `FundamentalProvider`에 페이지 전용 raw peer
 * 조회를 더한다. raw peer(symbol/companyName/marketCap)는 PeersTable이 렌더하는
 * 전부이며 per/psr enrich가 필요 없다 — enriched `getStockPeers`는 FactLayer(분석)
 * 전용으로 유지된다. `CachedFundamentalProvider`가 이 표면을 구현하고,
 * `FakeFundamentalDataProvider`(E2E)도 만족한다.
 */
export interface FundamentalProviderWithRawPeers extends FundamentalProvider {
    getStockPeersRaw(symbol: string): Promise<FundamentalPeerInput[]>;
}
