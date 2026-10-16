const {
    mockHandle,
    mockRun,
    mockCreateDeps,
    mockRunCikSync,
    mockCreateCikDeps,
} = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockRun: vi.fn(),
    mockCreateDeps: vi.fn(),
    mockRunCikSync: vi.fn(),
    mockCreateCikDeps: vi.fn(),
}));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('@/entities/investor-flows/server/syncCusipMap', () => ({
    runCusipMapSync: mockRun,
}));
vi.mock('@/entities/investor-flows/server/syncCikSymbolMap', () => ({
    runCikSymbolMapSync: mockRunCikSync,
}));
vi.mock('server-only', () => ({}));
vi.mock('../createDeps', () => ({
    createCusipMapDeps: mockCreateDeps,
    createCikSymbolMapDeps: mockCreateCikDeps,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FMP_TRANSIENT_RETRY } from '@/shared/api/fmp/fmpRetry';
import {
    SEC_REQUEST_TIMEOUT_MS,
    SEC_RETRY_BACKOFF_BUDGET_MS,
} from '@/shared/config/investorFlows';
import {
    LIMITS,
    OPENFIGI_TIMEOUT_MS,
} from '@/shared/api/openfigi/openFigiClient';
import { PATCH } from '../route';

/** FMP's non-render fetch timeout (`httpClient.ts`, not exported): one attempt. */
const FMP_FETCH_TIMEOUT_MS = 10_000;
/** DB writes after the last unit of work (upserts, miss records, `checked_at`): a generous allowance, not a timeout. */
const DB_ALLOWANCE_MS = 30_000;

describe('PATCH /api/cron/cusip-map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
    });

    it('delegates to the leased cron with the documented lease and deadline', async () => {
        await PATCH(
            new Request('http://localhost/api/cron/cusip-map', {
                method: 'PATCH',
            })
        );
        const [, options] = mockHandle.mock.calls[0] as [
            Request,
            { name: string; leaseTtlSeconds: number; deadlineMs: number },
        ];
        expect(options).toMatchObject({
            name: 'cusip-map',
            leaseTtlSeconds: 900,
            deadlineMs: 600_000,
        });
        // CC-7: past the deadline at most ONE unit is still in flight — an FMP profile chunk (concurrent calls, each with
        // its retries and the backoff budget) or one OpenFIGI batch (+ its spacing sleep). Every loop re-checks the
        // deadline before starting the next unit.
        const fmpCall =
            (FMP_TRANSIENT_RETRY.maxRetries + 1) * FMP_FETCH_TIMEOUT_MS +
            (FMP_TRANSIENT_RETRY.backoffBudgetMs ?? 0);
        const figiBatch = OPENFIGI_TIMEOUT_MS + LIMITS.anonymous.minIntervalMs;
        // the weekly CIK map refresh runs after the CUSIP sync: one SEC request + the map-replace transaction
        const cikMapRefresh =
            2 * SEC_REQUEST_TIMEOUT_MS +
            SEC_RETRY_BACKOFF_BUDGET_MS +
            DB_ALLOWANCE_MS;
        const worstCaseMs =
            options.deadlineMs +
            Math.max(fmpCall, figiBatch) +
            DB_ALLOWANCE_MS +
            cikMapRefresh;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(worstCaseMs);
    });

    it('wires the run to runCusipMapSync and then the weekly CIK map sync', async () => {
        mockCreateDeps.mockReturnValue({ marker: 'deps' });
        mockCreateCikDeps.mockReturnValue({ marker: 'cik-deps' });
        mockRun.mockResolvedValue({ status: 'complete' });
        mockRunCikSync.mockResolvedValue({
            status: 'fresh',
            pairs: 0,
            deleted: 0,
        });
        await PATCH(
            new Request('http://localhost/api/cron/cusip-map', {
                method: 'PATCH',
            })
        );
        const [, options] = mockHandle.mock.calls[0] as [
            Request,
            {
                run: (ctx: {
                    isDeadlineReached: () => boolean;
                }) => Promise<unknown>;
            },
        ];
        expect(await options.run({ isDeadlineReached: () => false })).toEqual({
            status: 'complete',
            cikMap: { status: 'fresh', pairs: 0, deleted: 0 },
        });
        expect(mockRun).toHaveBeenCalledWith({ marker: 'deps' });
        expect(mockRunCikSync).toHaveBeenCalledWith({ marker: 'cik-deps' });
    });
});
