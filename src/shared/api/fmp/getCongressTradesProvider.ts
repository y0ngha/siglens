import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import type { CongressTradesProvider } from '@y0ngha/siglens-core';
import { CachedCongressTradesProvider } from './CachedCongressTradesProvider';
import { FmpCongressTradesClient } from './congressTradesClient';

/** Returns the app's congress trades provider (FMP in prod, fake under E2E_TEST). */
export const getCongressTradesProvider: () => CongressTradesProvider =
    createE2EGatedSingleton(
        () => new CachedCongressTradesProvider(new FmpCongressTradesClient()),
        () => {
            // Sync factory — no dynamic import possible here, so the fake loads via a
            // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
            // still bundles it into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeCongressTradesProvider } =
                require('./FakeCongressTradesProvider') as typeof import('./FakeCongressTradesProvider');
            return new FakeCongressTradesProvider();
        }
    );
