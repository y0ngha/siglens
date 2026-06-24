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

        expect(mockConstructorArgs).toContainEqual(
            expect.objectContaining({
                suppressNotices: ['yahooSurvey'],
            })
        );
    });

    it('constructs YahooFinance with validation.logErrors disabled to suppress schema-validation noise', async () => {
        await import('@/entities/options-chain/lib/YahooOptionsAdapter');

        // validation.logErrors: false prevents multi-line "Failed Yahoo Schema
        // validation … This may happen intermittently…" messages that the library
        // emits by default (logErrors: true in defaults.js) whenever a symbol probe
        // hits an empty or malformed options response.  The FailedYahooValidationError
        // is still thrown and caught by the adapter's catch block — only the log is
        // suppressed.
        expect(mockConstructorArgs).toContainEqual(
            expect.objectContaining({
                validation: expect.objectContaining({ logErrors: false }),
            })
        );
    });
});
