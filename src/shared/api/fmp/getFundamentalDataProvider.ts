import { FmpFundamentalClient } from './fundamentalClient';
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import type { FundamentalProviderWithRawPeers } from './fundamentalProvider.types';

// Re-exported so existing importers (`@/shared/api/fmp/getFundamentalDataProvider`)
// keep resolving; the interfaces themselves live in `fundamentalProvider.types` to
// avoid a type-level cycle with the `CachedFundamentalProvider` class import above.
export type { FundamentalProvider } from './fundamentalProvider.types';
export type { FundamentalProviderWithRawPeers } from './fundamentalProvider.types';

/** Returns the app's fundamental data provider (FMP in prod, fake under E2E_TEST). */
export const getFundamentalDataProvider: () => FundamentalProviderWithRawPeers =
    createE2EGatedSingleton(
        () => new CachedFundamentalProvider(new FmpFundamentalClient()),
        () => {
            // Sync factory — no dynamic import possible here, so the fake loads via a
            // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
            // still bundles it into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeFundamentalDataProvider } =
                require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
            return new FakeFundamentalDataProvider();
        }
    );
