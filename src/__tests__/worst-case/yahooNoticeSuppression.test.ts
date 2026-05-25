vi.mock('@y0ngha/siglens-core', () => ({
    mapExpirationsToSlots: vi.fn().mockReturnValue([]),
    sanitizeOptionsChain: vi.fn((chain: unknown) => chain),
}));

vi.mock('@/shared/config/time', () => ({
    MS_PER_DAY: 86400000,
}));

const mockConstructorArgs: unknown[] = [];

vi.mock('yahoo-finance2', () => ({
    default: class MockYahooFinance {
        options = vi.fn().mockResolvedValue({
            underlyingSymbol: 'AAPL',
            expirationDates: [],
            strikes: [],
            hasMiniOptions: false,
            quote: { regularMarketPrice: 175 },
            options: [],
        });

        constructor(opts?: unknown) {
            mockConstructorArgs.push(opts);
        }
    },
}));

describe('Yahoo Finance notice suppression', () => {
    it('constructs YahooFinance with suppressNotices config', async () => {
        await import('@/entities/options-chain/lib/YahooOptionsAdapter');

        expect(mockConstructorArgs).toContainEqual({
            suppressNotices: ['yahooSurvey'],
        });
    });
});
