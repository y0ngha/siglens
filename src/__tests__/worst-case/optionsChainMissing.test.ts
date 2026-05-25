vi.mock('yahoo-finance2', () => {
    const options = vi.fn();
    return {
        default: class MockYahooFinance {
            options = (...args: unknown[]) => options(...args);
        },
        __mockOptions: options,
    };
});

vi.mock('@y0ngha/siglens-core', () => ({
    mapExpirationsToSlots: vi.fn().mockReturnValue([]),
    sanitizeOptionsChain: vi.fn((chain: unknown) => chain),
}));

vi.mock('@/shared/config/time', () => ({
    MS_PER_DAY: 86400000,
}));

import { YahooOptionsAdapter } from '@/entities/options-chain/lib/YahooOptionsAdapter';
import { sanitizeOptionsChain } from '@y0ngha/siglens-core';

const yahooModule = (await import('yahoo-finance2')) as Record<string, unknown>;
const mockYahooOptions = yahooModule.__mockOptions as ReturnType<typeof vi.fn>;
const mockSanitize = sanitizeOptionsChain as ReturnType<typeof vi.fn>;

describe('YahooOptionsAdapter failure modes', () => {
    const adapter = new YahooOptionsAdapter();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when underlyingPrice is 0', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockYahooOptions.mockResolvedValue({
            underlyingSymbol: 'AAPL',
            expirationDates: [new Date('2025-07-18')],
            strikes: [150, 155, 160],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 0 },
            options: [
                {
                    expirationDate: new Date('2025-07-18'),
                    hasMiniOptions: false,
                    calls: [
                        {
                            contractSymbol: 'AAPL250718C00150000',
                            strike: 150,
                            lastPrice: 5.0,
                            change: 0,
                            contractSize: 'REGULAR',
                            expiration: new Date('2025-07-18'),
                            lastTradeDate: new Date(),
                            impliedVolatility: 0.3,
                            inTheMoney: true,
                        },
                    ],
                    puts: [],
                },
            ],
        });

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('missing underlyingPrice'),
            'AAPL'
        );
    });

    it('returns null when all chains are rejected by sanitization', async () => {
        mockSanitize.mockReturnValue(null);
        mockYahooOptions.mockResolvedValue({
            underlyingSymbol: 'AAPL',
            expirationDates: [new Date('2025-07-18')],
            strikes: [150],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 175 },
            options: [
                {
                    expirationDate: new Date('2025-07-18'),
                    hasMiniOptions: false,
                    calls: [],
                    puts: [],
                },
            ],
        });

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null when options array is empty', async () => {
        mockYahooOptions.mockResolvedValue({
            underlyingSymbol: 'AAPL',
            expirationDates: [],
            strikes: [],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 175 },
            options: [],
        });

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null on API error and logs it', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockYahooOptions.mockRejectedValue(new Error('Yahoo API timeout'));

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            '[YahooOptionsAdapter] fetchSnapshot failed',
            expect.any(Error)
        );
    });

    describe('hasOptionsMarket', () => {
        it('returns false on API error', async () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockYahooOptions.mockRejectedValue(new Error('Network error'));

            const result = await adapter.hasOptionsMarket('AAPL');

            expect(result).toBe(false);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('returns false when no expiration dates', async () => {
            mockYahooOptions.mockResolvedValue({ expirationDates: [] });

            const result = await adapter.hasOptionsMarket('AAPL');

            expect(result).toBe(false);
        });

        it('returns true when expirations exist', async () => {
            mockYahooOptions.mockResolvedValue({
                expirationDates: [new Date('2025-07-18')],
            });

            const result = await adapter.hasOptionsMarket('AAPL');

            expect(result).toBe(true);
        });
    });
});
