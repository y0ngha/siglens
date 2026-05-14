/**
 * Unit tests for YahooOptionsAdapter.
 *
 * yahoo-finance2 is mocked entirely — no network calls are made.
 * sanitizeOptionsChain is mocked to act as a passthrough (identity) so that
 * we can test normalization and adapter logic independently from domain
 * sanitization rules.
 */

const mockOptionsMethod = jest.fn();

jest.mock('yahoo-finance2', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        options: mockOptionsMethod,
    })),
}));

jest.mock('@y0ngha/siglens-core', () => {
    const actual = jest.requireActual('@y0ngha/siglens-core') as Record<
        string,
        unknown
    >;
    return {
        ...actual,
        // Passthrough: return the chain as-is so adapter logic is isolated
        sanitizeOptionsChain: jest.fn((chain: unknown) => chain),
    };
});

import { sanitizeOptionsChain } from '@y0ngha/siglens-core';
import { YahooOptionsAdapter } from '@/infrastructure/options/YahooOptionsAdapter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal but complete CallOrPut fixture matching the live API shape. */
const makeContract = (
    strike: number,
    type: 'C' | 'P',
    overrides: Partial<{
        volume: number;
        openInterest: number;
        bid: number;
        ask: number;
        lastPrice: number;
        impliedVolatility: number;
        inTheMoney: boolean;
    }> = {}
) => ({
    contractSymbol: `AAPL260515${type}${String(strike * 1000).padStart(8, '0')}`,
    strike,
    currency: 'USD',
    lastPrice: overrides.lastPrice ?? 2.5,
    change: 0,
    percentChange: 0,
    volume: overrides.volume ?? 100,
    openInterest: overrides.openInterest ?? 200,
    bid: overrides.bid ?? 2.4,
    ask: overrides.ask ?? 2.6,
    contractSize: 'REGULAR' as const,
    expiration: new Date('2026-05-15T00:00:00.000Z'),
    lastTradeDate: new Date('2026-05-13T19:00:00.000Z'),
    impliedVolatility: overrides.impliedVolatility ?? 0.3,
    inTheMoney: overrides.inTheMoney ?? false,
});

/** Two expirations, each with 2 calls + 2 puts. Calls deliberately out of order to test sorting. */
const FULL_FIXTURE = {
    underlyingSymbol: 'AAPL',
    expirationDates: [
        new Date('2026-05-15T00:00:00.000Z'),
        new Date('2026-05-22T00:00:00.000Z'),
    ],
    strikes: [190, 195, 200, 205],
    hasMiniOptions: false,
    quote: { regularMarketPrice: 195 },
    options: [
        {
            expirationDate: new Date('2026-05-15T00:00:00.000Z'),
            hasMiniOptions: false,
            // Intentionally reverse order — adapter must sort ascending by strike
            calls: [makeContract(200, 'C'), makeContract(190, 'C')],
            puts: [makeContract(200, 'P'), makeContract(190, 'P')],
        },
        {
            expirationDate: new Date('2026-05-22T00:00:00.000Z'),
            hasMiniOptions: false,
            calls: [makeContract(195, 'C'), makeContract(205, 'C')],
            puts: [makeContract(195, 'P'), makeContract(205, 'P')],
        },
    ],
};

/** Single-expiration response as returned when `date` is passed to the library. */
const SINGLE_EXPIRY_FIXTURE = {
    underlyingSymbol: 'AAPL',
    expirationDates: [new Date('2026-05-22T00:00:00.000Z')],
    strikes: [195, 205],
    hasMiniOptions: false,
    quote: { regularMarketPrice: 195 },
    options: [
        {
            expirationDate: new Date('2026-05-22T00:00:00.000Z'),
            hasMiniOptions: false,
            calls: [makeContract(195, 'C'), makeContract(205, 'C')],
            puts: [makeContract(195, 'P'), makeContract(205, 'P')],
        },
    ],
};

const EMPTY_OPTIONS_FIXTURE = {
    ...FULL_FIXTURE,
    options: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(): YahooOptionsAdapter {
    return new YahooOptionsAdapter();
}

// ---------------------------------------------------------------------------
// fetchSnapshot
// ---------------------------------------------------------------------------

describe('YahooOptionsAdapter.fetchSnapshot', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (sanitizeOptionsChain as jest.Mock).mockImplementation((c) => c);
        consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('returns an OptionsSnapshot with chains sorted by expirationDate', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        expect(snapshot).not.toBeNull();
        expect(snapshot!.symbol).toBe('AAPL');
        expect(snapshot!.underlyingPrice).toBe(195);
        expect(snapshot!.chains).toHaveLength(2);
        expect(snapshot!.chains[0].expirationDate).toBe('2026-05-15');
        expect(snapshot!.chains[1].expirationDate).toBe('2026-05-22');
    });

    it('sorts calls and puts ascending by strike within each chain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        const firstChain = snapshot!.chains[0];
        expect(firstChain.calls[0].strike).toBe(190);
        expect(firstChain.calls[1].strike).toBe(200);
        expect(firstChain.puts[0].strike).toBe(190);
        expect(firstChain.puts[1].strike).toBe(200);
    });

    it('defaults volume and openInterest to 0 when undefined', async () => {
        const contractWithNulls = {
            ...makeContract(190, 'C'),
            volume: undefined,
            openInterest: undefined,
        };
        const fixture = {
            ...FULL_FIXTURE,
            options: [
                {
                    ...FULL_FIXTURE.options[0],
                    calls: [contractWithNulls],
                    puts: [],
                },
            ],
        };
        mockOptionsMethod.mockResolvedValue(fixture);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        const contract = snapshot!.chains[0].calls[0];
        expect(contract.volume).toBe(0);
        expect(contract.openInterest).toBe(0);
    });

    it('returns null when options array is empty', async () => {
        mockOptionsMethod.mockResolvedValue(EMPTY_OPTIONS_FIXTURE);
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null when all chains are rejected by sanitizeOptionsChain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        (sanitizeOptionsChain as jest.Mock).mockReturnValue(null);
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('catches library errors and returns null without throwing', async () => {
        mockOptionsMethod.mockRejectedValue(new Error('network timeout'));
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[YahooOptionsAdapter] fetchSnapshot failed',
            expect.any(Error)
        );
    });

    it('calls sanitizeOptionsChain for each chain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        await adapter.fetchSnapshot('AAPL');

        expect(sanitizeOptionsChain).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// fetchChain
// ---------------------------------------------------------------------------

describe('YahooOptionsAdapter.fetchChain', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (sanitizeOptionsChain as jest.Mock).mockImplementation((c) => c);
        consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('calls yahooFinance.options with the correct date option', async () => {
        mockOptionsMethod.mockResolvedValue(SINGLE_EXPIRY_FIXTURE);
        const adapter = makeAdapter();

        await adapter.fetchChain('AAPL', '2026-05-22');

        expect(mockOptionsMethod).toHaveBeenCalledWith('AAPL', {
            date: new Date('2026-05-22T00:00:00Z'),
        });
    });

    it('returns the normalized chain for the first options[0] entry', async () => {
        mockOptionsMethod.mockResolvedValue(SINGLE_EXPIRY_FIXTURE);
        const adapter = makeAdapter();

        const chain = await adapter.fetchChain('AAPL', '2026-05-22');

        expect(chain).not.toBeNull();
        expect(chain!.expirationDate).toBe('2026-05-22');
        expect(chain!.calls).toHaveLength(2);
        expect(chain!.puts).toHaveLength(2);
    });

    it('returns null when options array is empty', async () => {
        mockOptionsMethod.mockResolvedValue(EMPTY_OPTIONS_FIXTURE);
        const adapter = makeAdapter();

        const result = await adapter.fetchChain('AAPL', '2026-05-22');

        expect(result).toBeNull();
    });

    it('returns null when sanitizeOptionsChain rejects the chain', async () => {
        mockOptionsMethod.mockResolvedValue(SINGLE_EXPIRY_FIXTURE);
        (sanitizeOptionsChain as jest.Mock).mockReturnValue(null);
        const adapter = makeAdapter();

        const result = await adapter.fetchChain('AAPL', '2026-05-22');

        expect(result).toBeNull();
    });

    it('catches library errors and returns null without throwing', async () => {
        mockOptionsMethod.mockRejectedValue(new Error('not found'));
        const adapter = makeAdapter();

        const result = await adapter.fetchChain('AAPL', '2026-05-22');

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[YahooOptionsAdapter] fetchChain failed',
            expect.any(Error)
        );
    });
});

// ---------------------------------------------------------------------------
// hasOptionsMarket
// ---------------------------------------------------------------------------

describe('YahooOptionsAdapter.hasOptionsMarket', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns true when expirationDates is non-empty', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('AAPL');

        expect(result).toBe(true);
    });

    it('returns false when expirationDates is empty', async () => {
        mockOptionsMethod.mockResolvedValue({
            ...FULL_FIXTURE,
            expirationDates: [],
        });
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('AAPL');

        expect(result).toBe(false);
    });

    it('returns false on any library error', async () => {
        mockOptionsMethod.mockRejectedValue(new Error('unknown symbol'));
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('INVALID');

        expect(result).toBe(false);
    });
});
