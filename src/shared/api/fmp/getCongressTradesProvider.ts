import { isE2E } from '@/shared/api/e2eEnv';
import type { CongressTradesProvider } from '@y0ngha/siglens-core';
import { CachedCongressTradesProvider } from './CachedCongressTradesProvider';
import { FmpCongressTradesClient } from './congressTradesClient';

let cached: CongressTradesProvider | null = null;

/** Returns the app's congress trades provider (FMP in prod, fake under E2E_TEST). */
export function getCongressTradesProvider(): CongressTradesProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // Sync factory — no dynamic import possible here, so the fake loads via a
        // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
        // still bundles it into the server output).
        // Safe cast: require() returns the exact module object at runtime, but TS
        // cannot infer its shape from synchronous require(), so we assert it
        // matches the static import type of the same module.
        const { FakeCongressTradesProvider } =
            require('./FakeCongressTradesProvider') as typeof import('./FakeCongressTradesProvider');
        cached = new FakeCongressTradesProvider();
        return cached;
    }
    cached = new CachedCongressTradesProvider(new FmpCongressTradesClient());
    return cached;
}
