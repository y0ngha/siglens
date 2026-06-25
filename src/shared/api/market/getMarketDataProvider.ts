import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import { createE2EGatedSingleton } from '@/shared/api/fmp/createE2EGatedSingleton';

/** Returns the app's market data provider (FMP in prod, fake under E2E_TEST). */
export const getMarketDataProvider: () => MarketDataProvider =
    createE2EGatedSingleton(
        () => new FmpMarketProvider(),
        () => {
            // Sync factory — no dynamic import possible here, so the fake + fixture load
            // via a gated require. Server-only and dead when E2E_TEST is unset
            // (Turbopack still bundles them into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeMarketProvider } =
                require('./FakeMarketProvider') as typeof import('./FakeMarketProvider');
            return new FakeMarketProvider();
        }
    );
