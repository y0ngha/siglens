import { FmpNewsClient } from './fmpNewsClient';

/**
 * `FmpNewsClient` is a siglens class (not a core port). Its public surface
 * (`fetchNews`, `fetchNewsForPeriod`, `fetchEarningsReport`) is the contract
 * callers depend on; `FakeNewsClient` is structurally assignable to it, so the
 * factory return type is the class itself.
 */
let cached: FmpNewsClient | null = null;

/** Returns the app's news client (FMP in prod, fake under E2E_TEST). */
export function getNewsClient(): FmpNewsClient {
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
