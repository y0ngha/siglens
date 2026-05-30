import { describe, it, expect } from 'vitest';
import { getNewsClient } from '../../lib/getNewsClient';
import { FmpNewsClient } from '../../lib/fmpNewsClient';

/**
 * Branch + singleton tests for getNewsClient, mirroring the established
 * getMarketDataProvider.test.ts precedent.
 *
 * The E2E_TEST=1 branch `require('./FakeNewsClient')`s the fake to keep it out
 * of the production bundle. vitest's node module runner cannot resolve a
 * relative CJS `require` of a source module (it throws "Cannot find module" —
 * vi.mock does not intercept require either), so that branch is exercised by the
 * E2E suite, not here. These unit tests cover the prod path: the real FMP client
 * is returned and cached as a singleton.
 */
describe('getNewsClient', () => {
    it('returns a singleton (same instance across calls)', () => {
        expect(getNewsClient()).toBe(getNewsClient());
    });

    it('returns the real FmpNewsClient when E2E_TEST is unset', () => {
        expect(getNewsClient()).toBeInstanceOf(FmpNewsClient);
    });

    it('exposes the NewsClientPort surface callers depend on', () => {
        const client = getNewsClient();
        expect(typeof client.fetchNews).toBe('function');
        expect(typeof client.fetchNewsForPeriod).toBe('function');
        expect(typeof client.fetchEarningsReport).toBe('function');
    });
});
