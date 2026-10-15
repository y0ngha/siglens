import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInvestorFlowsDataProvider } from '../../server/getInvestorFlowsDataProvider';

vi.mock('server-only', () => ({}));

const { mockClient, mockFmp, mockEnabled } = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockFmp: vi.fn(),
    mockEnabled: vi.fn(() => true),
}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/fmp/getInvestorFlowsFmpProvider', () => ({
    getInvestorFlowsFmpProvider: mockFmp,
}));
const { mockE2E } = vi.hoisted(() => ({ mockE2E: vi.fn(() => false) }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockE2E }));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockEnabled,
}));

describe('getInvestorFlowsDataProvider', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockFmp.mockReset();
        mockEnabled.mockReturnValue(true);
        mockE2E.mockReturnValue(false);
    });

    // NOTE: the E2E branch (`require('./FakeInvestorFlowsDataProvider')`) is not unit-tested: vitest cannot
    // resolve the synchronous require (same limitation as getInvestorFlowsFmpProvider.test.ts). The fake itself is
    // covered by investorFlowsCachedProviderAndFake.test.ts; the e2e specs exercise the gate end to end.

    it('throws when the database is unavailable instead of faking an empty snapshot', () => {
        mockClient.mockReturnValue(null);
        expect(() => getInvestorFlowsDataProvider()).toThrow(
            '[investor-flows] database unavailable'
        );
    });

    it('returns a provider exposing the port method', () => {
        mockClient.mockReturnValue({ db: {} });
        mockFmp.mockReturnValue({});
        expect(
            getInvestorFlowsDataProvider().getInvestorFlowsSnapshot
        ).toBeTypeOf('function');
    });

    it('does not touch FINRA tables when the flag is off (end to end through the real reads wiring)', async () => {
        mockEnabled.mockReturnValue(false);
        const executed: string[] = [];
        // A db whose every query records itself and returns no rows.
        const chain: unknown = new Proxy(() => undefined, {
            get(_t, prop) {
                if (prop === 'then')
                    return (resolve: (v: unknown) => unknown) => resolve([]);
                return () => chain;
            },
            apply: () => chain,
        });
        mockClient.mockReturnValue({
            db: {
                select: (cols: unknown) => {
                    executed.push(
                        JSON.stringify(Object.keys((cols ?? {}) as object))
                    );
                    return chain;
                },
            },
        });
        mockFmp.mockReturnValue({
            getInsiderTrades: async () => [],
            getInsiderStatistics: async () => [],
            getBeneficialOwnership: async () => [],
            getSharesFloat: async () => null,
        });
        const snapshot =
            await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(
                'AAPL'
            );
        expect(snapshot).toBeNull();
        // only the cusip lookup (`cusip`) ran; no settlementDate/tradeDate (FINRA) selects
        expect(executed).toEqual(['["cusip"]']);
    });
});
