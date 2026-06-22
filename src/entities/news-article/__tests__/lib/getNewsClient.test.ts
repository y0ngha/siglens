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

    // --- crypto branch singleton isolation (Required #3) ---
    // getNewsClient('crypto') must return a distinct, stable singleton that is
    // NOT the same instance as the default 'stock' client. The two caches
    // (`cachedStock` / `cachedCrypto`) are module-level, so repeated calls must
    // return the same object within a test run.

    it("getNewsClient('crypto') returns a distinct singleton from getNewsClient('stock')", () => {
        const stock = getNewsClient('stock');
        const crypto = getNewsClient('crypto');
        // Different cache slots → different instances.
        expect(crypto).not.toBe(stock);
    });

    it("getNewsClient('crypto') is stable (same instance across repeated calls)", () => {
        expect(getNewsClient('crypto')).toBe(getNewsClient('crypto'));
    });

    it("getNewsClient('crypto') is an FmpNewsClient", () => {
        expect(getNewsClient('crypto')).toBeInstanceOf(FmpNewsClient);
    });

    it("getNewsClient('stock') explicit matches no-arg default (same cachedStock slot)", () => {
        // Calling with 'stock' explicit must return the same instance as the
        // default (no-arg) call because both hit the `cachedStock` slot.
        expect(getNewsClient('stock')).toBe(getNewsClient());
    });
});
