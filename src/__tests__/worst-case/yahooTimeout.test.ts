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

const yahooModule = (await import('yahoo-finance2')) as Record<string, unknown>;
const mockYahooOptions = yahooModule.__mockOptions as ReturnType<typeof vi.fn>;

describe('Yahoo API timeout and error scenarios', () => {
    const adapter = new YahooOptionsAdapter();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns null on network timeout', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockYahooOptions.mockRejectedValue(
            new Error('network timeout at: https://query2.finance.yahoo.com')
        );

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null when Yahoo returns HTML error page', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockYahooOptions.mockRejectedValue(
            new Error('Unexpected token < in JSON at position 0')
        );

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null on 429 rate limit', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const rateLimitError = new Error('Too Many Requests');
        (rateLimitError as Error & { status: number }).status = 429;
        mockYahooOptions.mockRejectedValue(rateLimitError);

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('handles response with 100+ expiration dates', async () => {
        const expirations = Array.from({ length: 120 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + 7 * (i + 1));
            return d;
        });

        mockYahooOptions.mockResolvedValue({
            underlyingSymbol: 'SPY',
            expirationDates: expirations,
            strikes: [400, 410, 420],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 415 },
            options: [
                {
                    expirationDate: expirations[0],
                    hasMiniOptions: false,
                    calls: [
                        {
                            contractSymbol: 'SPY250718C00400000',
                            strike: 400,
                            lastPrice: 15.0,
                            change: 0,
                            contractSize: 'REGULAR',
                            expiration: expirations[0],
                            lastTradeDate: new Date(),
                            impliedVolatility: 0.2,
                            inTheMoney: true,
                        },
                    ],
                    puts: [],
                },
            ],
        });

        const result = await adapter.fetchSnapshot('SPY');

        expect(result).not.toBeNull();
    });

    it('hasOptionsMarket returns false on timeout', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockYahooOptions.mockRejectedValue(new Error('Timeout'));

        const result = await adapter.hasOptionsMarket('AAPL');

        expect(result).toBe(false);
    });

    it('warns but continues when individual expiration fetch fails', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { mapExpirationsToSlots } = await import('@y0ngha/siglens-core');
        const mockMap = mapExpirationsToSlots as ReturnType<typeof vi.fn>;
        mockMap.mockReturnValue([{ slot: '1M', expirationDate: '2025-08-15' }]);

        mockYahooOptions
            .mockResolvedValueOnce({
                underlyingSymbol: 'AAPL',
                expirationDates: [
                    new Date('2025-07-18'),
                    new Date('2025-08-15'),
                ],
                strikes: [150],
                hasMiniOptions: false,
                quote: { regularMarketPrice: 175 },
                options: [
                    {
                        expirationDate: new Date('2025-07-18'),
                        hasMiniOptions: false,
                        calls: [
                            {
                                contractSymbol: 'AAPL250718C00150000',
                                strike: 150,
                                lastPrice: 25,
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
            })
            .mockRejectedValueOnce(new Error('Timeout on expiration fetch'));

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).not.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            '[YahooOptionsAdapter] fetch expiration failed',
            'AAPL',
            expect.any(String),
            expect.any(Error)
        );
    });
});
