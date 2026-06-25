import { FmpFundamentalClient } from './fundamentalClient';
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
import { createE2EGatedSingleton } from './createE2EGatedSingleton';
import type { FundamentalProvider } from './fundamentalProvider.types';

// Re-exported so existing importers (`@/shared/api/fmp/getFundamentalDataProvider`)
// keep resolving; the interface itself lives in `fundamentalProvider.types` to
// avoid a type-level cycle with the `CachedFundamentalProvider` class import above.
export type { FundamentalProvider } from './fundamentalProvider.types';

/** Returns the app's fundamental data provider (FMP in prod, fake under E2E_TEST). */
export const getFundamentalDataProvider: () => FundamentalProvider =
    createE2EGatedSingleton(
        () => new CachedFundamentalProvider(new FmpFundamentalClient()),
        () => {
            // Sync factory — no dynamic import possible here, so the fake loads via a
            // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
            // still bundles it into the server output).
            const { FakeFundamentalDataProvider } =
                require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
            return new FakeFundamentalDataProvider();
        }
    );
