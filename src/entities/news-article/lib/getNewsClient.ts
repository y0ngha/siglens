import { FmpNewsClient } from './fmpNewsClient';
import type { NewsClientPort } from './newsClientPort';
import { isE2E } from '@/shared/api/e2eEnv';

let cachedStock: NewsClientPort | null = null;
let cachedCrypto: NewsClientPort | null = null;
let cachedFake: NewsClientPort | null = null;

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(
    newsSource: 'stock' | 'crypto' = 'stock'
): NewsClientPort {
    if (isE2E()) {
        // Singleton fake: FakeNewsClient holds call-tracking state used by E2E
        // assertions, so all callers must share the same instance. Sync require()
        // keeps the fake out of the production bundle (Turbopack dead-code).
        if (!cachedFake) {
            const { FakeNewsClient } =
                require('./FakeNewsClient') as typeof import('./FakeNewsClient');
            cachedFake = new FakeNewsClient();
        }
        return cachedFake;
    }
    if (newsSource === 'crypto') {
        if (!cachedCrypto) cachedCrypto = new FmpNewsClient('crypto');
        return cachedCrypto;
    }
    if (!cachedStock) cachedStock = new FmpNewsClient('stock');
    return cachedStock;
}
