import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import { isE2E } from '@/shared/api/e2eEnv';

let cached: MarketDataProvider | null = null;

/** Returns the app's market data provider (FMP in prod, fake under E2E_TEST). */
export function getMarketDataProvider(): MarketDataProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // Sync factory — no dynamic import possible here, so the fake + fixture load
        // via a gated require. Server-only and dead when E2E_TEST is unset
        // (Turbopack still bundles them into the server output).
        const { FakeMarketProvider } =
            require('./FakeMarketProvider') as typeof import('./FakeMarketProvider');
        cached = new FakeMarketProvider();
        return cached;
    }
    cached = new FmpMarketProvider();
    return cached;
}
