import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    // The real `cache` memoizes per request scope; per-test calls must recompute.
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

const { mockCache, mockLoad, mockClient, mockFinra, mockE2E } = vi.hoisted(
    () => ({
        mockCache: vi.fn(),
        mockLoad: vi.fn(),
        mockClient: vi.fn(),
        mockFinra: vi.fn(() => true),
        mockE2E: vi.fn(() => false),
    })
);
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockCache,
}));
vi.mock('../../server/loadInvestorFlowsPipelineReadiness', () => ({
    loadInvestorFlowsPipelineReadiness: mockLoad,
}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockFinra,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockE2E }));

import { INVESTOR_FLOWS_READINESS_TAG } from '../../lib/investorFlowsTag';
import { getInvestorFlowsPipelineReadiness } from '../../server/getInvestorFlowsPipelineReadiness';

const READY = { institutional: 'ready', short: 'ready' } as const;
const COLLECTING = {
    institutional: 'collecting',
    short: 'collecting',
} as const;

describe('getInvestorFlowsPipelineReadiness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFinra.mockReturnValue(true);
        mockE2E.mockReturnValue(false);
        mockClient.mockReturnValue({ db: {} });
        // Run the fetcher the way the real cache does on a miss.
        mockCache.mockImplementation(
            async (_keys: string[], _scope: string, fetcher: () => unknown) =>
                fetcher()
        );
    });

    afterEach(() => {
        delete process.env.E2E_FLOWS_PIPELINE;
        vi.restoreAllMocks();
    });

    it('returns the loaded readiness (ready and not-ready are both passed through)', async () => {
        mockLoad.mockResolvedValueOnce(READY);
        expect(await getInvestorFlowsPipelineReadiness()).toEqual(READY);
        mockLoad.mockResolvedValueOnce(COLLECTING);
        expect(await getInvestorFlowsPipelineReadiness()).toEqual(COLLECTING);
    });

    it('is cached for 12h under the global tag, keyed by the FINRA flag and not by symbol', async () => {
        mockLoad.mockResolvedValue(READY);
        await getInvestorFlowsPipelineReadiness();
        const call = mockCache.mock.calls.find(
            args => args[0][0] === 'investor-flows:pipeline-readiness-v1'
        );
        expect(call?.[0]).toEqual([
            'investor-flows:pipeline-readiness-v1',
            'finra-on',
        ]);
        expect(call?.[3]).toEqual([INVESTOR_FLOWS_READINESS_TAG]);
        expect(call?.[4]).toBe(43_200);

        mockFinra.mockReturnValue(false);
        await getInvestorFlowsPipelineReadiness();
        expect(
            mockCache.mock.calls.some(args => args[0][1] === 'finra-off')
        ).toBe(true);
    });

    it('a DB error is "unknown", never "collecting" (and the error is not swallowed silently)', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockLoad.mockRejectedValue(new Error('db down'));
        expect(await getInvestorFlowsPipelineReadiness()).toEqual({
            institutional: 'unknown',
            short: 'unknown',
        });
        expect(error).toHaveBeenCalled();
    });

    it('no database client is also unknown', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockClient.mockReturnValue(null);
        mockLoad.mockImplementation(() => {
            throw new Error('unreachable');
        });
        // loadFromDatabase throws before reaching the loader
        expect(await getInvestorFlowsPipelineReadiness()).toEqual({
            institutional: 'unknown',
            short: 'unknown',
        });
        expect(mockLoad).not.toHaveBeenCalled();
    });

    it('rethrows Next static-generation control-flow errors instead of mapping them to unknown', async () => {
        const dynamicError = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockCache.mockRejectedValue(dynamicError);
        await expect(getInvestorFlowsPipelineReadiness()).rejects.toBe(
            dynamicError
        );
    });

    describe('under E2E', () => {
        beforeEach(() => mockE2E.mockReturnValue(true));

        it('is ready without touching the cache or the database by default', async () => {
            expect(await getInvestorFlowsPipelineReadiness()).toEqual(READY);
            expect(mockCache).not.toHaveBeenCalled();
            expect(mockLoad).not.toHaveBeenCalled();
        });

        it('E2E_FLOWS_PIPELINE=collecting reproduces the bootstrap period', async () => {
            process.env.E2E_FLOWS_PIPELINE = 'collecting';
            expect(await getInvestorFlowsPipelineReadiness()).toEqual(
                COLLECTING
            );
        });

        it('short is not applicable (unknown) when the FINRA flag is off', async () => {
            process.env.E2E_FLOWS_PIPELINE = 'collecting';
            mockFinra.mockReturnValue(false);
            expect(await getInvestorFlowsPipelineReadiness()).toEqual({
                institutional: 'collecting',
                short: 'unknown',
            });
        });
    });
});
