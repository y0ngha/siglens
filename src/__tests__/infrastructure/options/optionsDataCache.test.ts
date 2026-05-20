/**
 * Unit tests for optionsDataCache delegation.
 *
 * The `'use cache'` directive is a Next.js compiler directive — in the jest
 * runtime it has no effect, and `cacheLife` / `cacheTag` from `next/cache`
 * are already mocked to noops in `jest.setup.ts`. We therefore verify the
 * functions' *forwarding* contract: that arguments and return values flow
 * unchanged through the wrapper to the underlying `YahooOptionsAdapter`.
 */

jest.mock('server-only', () => ({}), { virtual: true });

const mockHasOptionsMarket = jest.fn();
const mockFetchSnapshot = jest.fn();

jest.mock('@/infrastructure/options/YahooOptionsAdapter', () => ({
    YahooOptionsAdapter: jest.fn().mockImplementation(() => ({
        hasOptionsMarket: mockHasOptionsMarket,
        fetchSnapshot: mockFetchSnapshot,
    })),
}));

jest.mock('@/infrastructure/options/optionsCacheLife', () => ({
    getOptionsCacheLifeProfile: jest.fn(() => 'options-market-open'),
}));

import {
    hasOptionsMarket,
    fetchOptionsSnapshot,
} from '@/infrastructure/options/optionsDataCache';

describe('hasOptionsMarket', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards the symbol to YahooOptionsAdapter.hasOptionsMarket', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);

        const result = await hasOptionsMarket('AAPL');

        expect(mockHasOptionsMarket).toHaveBeenCalledWith('AAPL');
        expect(mockHasOptionsMarket).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
    });

    it('returns false when the adapter reports no options market', async () => {
        mockHasOptionsMarket.mockResolvedValue(false);

        const result = await hasOptionsMarket('NOOPT');

        expect(result).toBe(false);
    });

    it('propagates the adapter return value verbatim', async () => {
        mockHasOptionsMarket.mockResolvedValue(true);
        await expect(hasOptionsMarket('MSFT')).resolves.toBe(true);

        mockHasOptionsMarket.mockResolvedValue(false);
        await expect(hasOptionsMarket('MSFT')).resolves.toBe(false);
    });
});

describe('fetchOptionsSnapshot', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('forwards the symbol to YahooOptionsAdapter.fetchSnapshot', async () => {
        const snapshot = {
            symbol: 'AAPL',
            underlyingPrice: 195,
            chains: [],
            capturedAt: '2026-05-14T16:00:00Z',
        };
        mockFetchSnapshot.mockResolvedValue(snapshot);

        const result = await fetchOptionsSnapshot('AAPL');

        expect(mockFetchSnapshot).toHaveBeenCalledWith('AAPL');
        expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
        expect(result).toBe(snapshot);
    });

    it('returns null when the adapter has no snapshot', async () => {
        mockFetchSnapshot.mockResolvedValue(null);

        const result = await fetchOptionsSnapshot('NOOPT');

        expect(result).toBeNull();
    });

    it('preserves the adapter snapshot object identity (no shallow copy)', async () => {
        const snapshot = {
            symbol: 'TSLA',
            underlyingPrice: 250,
            chains: [],
            capturedAt: '2026-05-14T16:00:00Z',
        };
        mockFetchSnapshot.mockResolvedValue(snapshot);

        const result = await fetchOptionsSnapshot('TSLA');

        expect(result).toBe(snapshot);
    });
});
