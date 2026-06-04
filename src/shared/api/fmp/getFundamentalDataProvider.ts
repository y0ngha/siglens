import { FmpFundamentalClient } from './fundamentalClient';
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
import type { FundamentalProvider } from './fundamentalProvider.types';
import { isE2E } from '@/shared/api/e2eEnv';

// Re-exported so existing importers (`@/shared/api/fmp/getFundamentalDataProvider`)
// keep resolving; the interface itself lives in `fundamentalProvider.types` to
// avoid a type-level cycle with the `CachedFundamentalProvider` class import above.
export type { FundamentalProvider } from './fundamentalProvider.types';

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
