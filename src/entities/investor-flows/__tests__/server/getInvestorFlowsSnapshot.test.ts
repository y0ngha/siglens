import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../../lib/investorFlowsTag';
import { getInvestorFlowsSnapshot } from '../../server/getInvestorFlowsSnapshot';

vi.mock('server-only', () => ({}));

const { mockStaticSymbolCache, mockEnabled, mockProvider } = vi.hoisted(() => ({
    mockStaticSymbolCache: vi.fn(),
    mockEnabled: vi.fn(() => true),
    mockProvider: vi.fn(),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockEnabled,
}));
vi.mock('../../server/getInvestorFlowsDataProvider', () => ({
    getInvestorFlowsDataProvider: mockProvider,
}));

describe('getInvestorFlowsSnapshot', () => {
    beforeEach(() => {
        mockStaticSymbolCache.mockReset();
        mockStaticSymbolCache.mockImplementation(
            async (_k: string[], _s: string, fetcher: () => Promise<unknown>) =>
                fetcher()
        );
        mockEnabled.mockReturnValue(true);
        mockProvider.mockReturnValue({
            getInvestorFlowsSnapshot: vi.fn(async () => ({ asOf: 'x' })),
        });
    });

    it('caches through staticSymbolCache with a symbol tag, a per-symbol group tag and a 12h revalidate', async () => {
        await getInvestorFlowsSnapshot('aapl');
        const [keyParts, symbol, , tags, revalidate] = mockStaticSymbolCache
            .mock.calls[0] as [string[], string, unknown, string[], number];
        expect(symbol).toBe('AAPL');
        // the readiness tag lets the 13F/FINRA bootstrap flip refresh every symbol's (possibly empty) snapshot — and the ISR
        // pages that read it — in one revalidation
        expect(tags).toEqual([
            'investor-flows:AAPL',
            INVESTOR_FLOWS_READINESS_TAG,
        ]);
        expect(revalidate).toBe(43200);
        expect(keyParts).toContain('AAPL');
    });

    it('puts the FINRA flag state in the cache key so flipping it takes effect immediately', async () => {
        await getInvestorFlowsSnapshot('AAPL');
        mockEnabled.mockReturnValue(false);
        await getInvestorFlowsSnapshot('AAPL');
        const [on, off] = mockStaticSymbolCache.mock.calls.map(call =>
            (call[0] as string[]).join('|')
        );
        expect(on).toContain('finra-on');
        expect(off).toContain('finra-off');
        expect(on).not.toBe(off);
    });

    it('asks the provider for the uppercased symbol inside the cached fetcher', async () => {
        const getSnapshot = vi.fn(async () => null);
        mockProvider.mockReturnValue({ getInvestorFlowsSnapshot: getSnapshot });
        await getInvestorFlowsSnapshot('msft');
        expect(getSnapshot).toHaveBeenCalledWith('MSFT');
    });

    it('exposes the per-symbol invalidation tag', () => {
        expect(investorFlowsTag('nvda')).toBe('investor-flows:NVDA');
    });
});
