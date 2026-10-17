import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../../lib/investorFlowsTag';
import {
    getInvestorFlowsSnapshot,
    INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS,
} from '../../server/getInvestorFlowsSnapshot';

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

    describe('a snapshot degraded by a transient FMP error (429 → largeHolders/float null)', () => {
        const degradedSnapshot = {
            asOf: 'x',
            largeHolders: null,
            degraded: ['largeHolders'],
        };
        beforeEach(() => {
            mockProvider.mockReturnValue({
                getInvestorFlowsSnapshot: vi.fn(async () => degradedSnapshot),
            });
        });

        it('is kept out of the 12h entry and served from a separate 10-minute entry', async () => {
            const result = await getInvestorFlowsSnapshot('AAPL');
            expect(result).toEqual(degradedSnapshot);
            expect(mockStaticSymbolCache).toHaveBeenCalledTimes(2);
            const calls = mockStaticSymbolCache.mock.calls as [
                string[],
                string,
                unknown,
                string[],
                number,
            ][];
            const main = calls.find(([key]) =>
                key.includes('investor-flows:snapshot-v3')
            );
            const short = calls.find(([key]) =>
                key.includes('investor-flows:snapshot-degraded-v1')
            );
            if (main === undefined || short === undefined)
                throw new Error('expected both cache entries to be read');
            expect(main[4]).toBe(43200);
            expect(short[4]).toBe(INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS);
            expect(INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS).toBe(600);
            // a different key, so the 12h entry is never the degraded one; same tags so invalidation still reaches it
            expect(short[0].join('|')).not.toBe(main[0].join('|'));
            expect(short[0]).toContain('AAPL');
            expect(short[3]).toEqual(main[3]);
        });

        it('rejects inside the 12h fetcher so unstable_cache never stores it there', async () => {
            const fetchers: (() => Promise<unknown>)[] = [];
            mockStaticSymbolCache.mockImplementation(
                async (
                    _k: string[],
                    _s: string,
                    fetcher: () => Promise<unknown>
                ) => {
                    fetchers.push(fetcher);
                    return fetcher();
                }
            );
            await getInvestorFlowsSnapshot('AAPL');
            await expect(fetchers[0]?.()).rejects.toThrow('degraded snapshot');
        });
    });

    it('keeps an intact snapshot in the 12h entry only', async () => {
        await getInvestorFlowsSnapshot('AAPL');
        expect(mockStaticSymbolCache).toHaveBeenCalledTimes(1);
    });

    it('propagates infrastructure errors instead of caching them short', async () => {
        mockProvider.mockReturnValue({
            getInvestorFlowsSnapshot: vi.fn(async () => {
                throw new Error('db down');
            }),
        });
        await expect(getInvestorFlowsSnapshot('AAPL')).rejects.toThrow(
            'db down'
        );
        expect(mockStaticSymbolCache).toHaveBeenCalledTimes(1);
    });

    it('exposes the per-symbol invalidation tag', () => {
        expect(investorFlowsTag('nvda')).toBe('investor-flows:NVDA');
    });
});
