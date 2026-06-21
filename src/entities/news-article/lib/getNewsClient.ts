import { FmpNewsClient } from './fmpNewsClient';
import type { NewsClientPort } from './newsClientPort';
import { isE2E } from '@/shared/api/e2eEnv';

let cachedStock: NewsClientPort | null = null;
let cachedCrypto: NewsClientPort | null = null;

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(
    newsSource: 'stock' | 'crypto' = 'stock'
): NewsClientPort {
    if (isE2E()) {
        // Sync factory — no dynamic import possible here, so the fake loads via a
        // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
        // still bundles it into the server output).
        const { FakeNewsClient } =
            require('./FakeNewsClient') as typeof import('./FakeNewsClient');
        return new FakeNewsClient();
    }
    if (newsSource === 'crypto') {
        if (!cachedCrypto) cachedCrypto = new FmpNewsClient('crypto');
        return cachedCrypto;
    }
    if (!cachedStock) cachedStock = new FmpNewsClient('stock');
    return cachedStock;
}
