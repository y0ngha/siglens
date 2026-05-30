import { describe, it, expect, vi } from 'vitest';

// vi.mock is hoisted above imports, so FakeMarketProvider's
// `import bars from '@e2e/fixtures/bars.json'` resolves to this empty array.
// This forces FIXTURE_BARS.at(-1) === undefined, exercising the getQuote
// null-guard branch that the static 3-bar fixture can never reach.
vi.mock('@e2e/fixtures/bars.json', () => ({ default: [] }));

describe('FakeMarketProvider (empty fixture)', () => {
    it('fixture가 비어 있으면 getQuote가 null을 반환한다', async () => {
        const { FakeMarketProvider } =
            await import('@/shared/api/market/FakeMarketProvider');

        const quote = await new FakeMarketProvider().getQuote('AAPL');

        expect(quote).toBeNull();
    });
});
