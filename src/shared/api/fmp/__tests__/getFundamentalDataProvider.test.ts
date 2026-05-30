import { describe, it, expect } from 'vitest';
import { getFundamentalDataProvider } from '../getFundamentalDataProvider';
import { FmpFundamentalClient } from '../fundamentalClient';

/**
 * Branch + singleton tests for getFundamentalDataProvider, mirroring the
 * established getMarketDataProvider.test.ts precedent.
 *
 * The E2E_TEST=1 branch `require('./FakeFundamentalDataProvider')`s the fake to
 * keep it out of the production bundle. vitest's node module runner cannot
 * resolve a relative CJS `require` of a source module (it throws "Cannot find
 * module" — vi.mock does not intercept require either), so that branch is
 * exercised by the E2E suite, not here. These unit tests cover the prod path:
 * the real FMP instance is returned and cached as a singleton.
 */
describe('getFundamentalDataProvider', () => {
    it('returns a singleton (same instance across calls)', () => {
        expect(getFundamentalDataProvider()).toBe(getFundamentalDataProvider());
    });

    it('returns the real FmpFundamentalClient when E2E_TEST is unset', () => {
        expect(getFundamentalDataProvider()).toBeInstanceOf(
            FmpFundamentalClient
        );
    });

    it('exposes the siglens-specific extras the FundamentalProvider surface requires', () => {
        const provider = getFundamentalDataProvider();
        expect(typeof provider.getGrades).toBe('function');
        expect(typeof provider.getEarningsReports).toBe('function');
    });
});
