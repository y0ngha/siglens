import { FmpNewsClient } from './fmpNewsClient';
import type { NewsClientPort } from './newsClientPort';

let cached: NewsClientPort | null = null;

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(): NewsClientPort {
    if (cached !== null) return cached;
    if (process.env.E2E_TEST === '1') {
        // require keeps the fake out of the production bundle.
        const { FakeNewsClient } =
            require('./FakeNewsClient') as typeof import('./FakeNewsClient');
        cached = new FakeNewsClient();
        return cached;
    }
    cached = new FmpNewsClient();
    return cached;
}
