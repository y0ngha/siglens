import { describe, it, expect } from 'vitest';
import { getOptionsProvider } from '../../lib/getOptionsProvider';
import { YahooOptionsAdapter } from '../../lib/YahooOptionsAdapter';

/**
 * Branch + singleton tests for getOptionsProvider, mirroring the established
 * getMarketDataProvider.test.ts precedent.
 *
 * The E2E_TEST=1 branch `require('./FakeOptionsDataProvider')`s the fake to keep
 * it out of the production bundle. vitest's node module runner cannot resolve a
 * relative CJS `require` of a source module (it throws "Cannot find module" —
 * vi.mock does not intercept require either), so that branch is exercised by the
 * E2E suite, not here. These unit tests cover the prod path: the real Yahoo
 * adapter is returned and cached as a singleton.
 */
describe('getOptionsProvider', () => {
    it('returns a singleton (same instance across calls)', () => {
        expect(getOptionsProvider()).toBe(getOptionsProvider());
    });

    it('returns the real YahooOptionsAdapter when E2E_TEST is unset', () => {
        expect(getOptionsProvider()).toBeInstanceOf(YahooOptionsAdapter);
    });

    it('exposes the OptionsDataProvider surface callers depend on', () => {
        const provider = getOptionsProvider();
        expect(typeof provider.fetchSnapshot).toBe('function');
        expect(typeof provider.hasOptionsMarket).toBe('function');
    });
});
