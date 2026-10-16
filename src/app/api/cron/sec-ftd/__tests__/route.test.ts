const { mockHandle, mockRun, mockCreateDeps } = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockRun: vi.fn(),
    mockCreateDeps: vi.fn(),
}));
vi.mock('../../leasedCron', async importOriginal => ({
    ...(await importOriginal<typeof import('../../leasedCron')>()),
    handleLeasedCron: mockHandle,
}));
vi.mock('@/entities/investor-flows/server/ingestFtd', () => ({
    runFtdIngest: mockRun,
}));
vi.mock('../createDeps', () => ({ createSecFtdDeps: mockCreateDeps }));
vi.mock('server-only', () => ({}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SEC_REQUEST_TIMEOUT_MS,
    SEC_RETRY_BACKOFF_BUDGET_MS,
} from '@/shared/config/investorFlows';
import { SEC_CRON_LEASE_NAME } from '../../leasedCron';
import { PATCH } from '../route';

/** DB work after the last file (one file's upsert + the prune): an allowance, not a timeout. */
const DB_ALLOWANCE_MS = 120_000;

type RunOptions = {
    name: string;
    leaseName?: string;
    leaseTtlSeconds: number;
    deadlineMs: number;
    run: (ctx: { isDeadlineReached: () => boolean }) => Promise<unknown>;
};

async function capturedOptions(): Promise<RunOptions> {
    await PATCH(
        new Request('http://localhost/api/cron/sec-ftd', { method: 'PATCH' })
    );
    const call = mockHandle.mock.calls.find(
        ([, options]) => (options as RunOptions).name === 'sec-ftd'
    );
    return call?.[1] as RunOptions;
}

describe('PATCH /api/cron/sec-ftd', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
    });

    it('shares the SEC lease with sec-13f and uses the documented TTL and deadline', async () => {
        expect(await capturedOptions()).toMatchObject({
            name: 'sec-ftd',
            leaseName: SEC_CRON_LEASE_NAME,
            leaseTtlSeconds: 600,
            deadlineMs: 300_000,
        });
    });

    it('CC-7: the lease outlives the deadline plus one file in flight and the DB wrap-up', async () => {
        const options = await capturedOptions();
        const oneFile =
            2 * SEC_REQUEST_TIMEOUT_MS + SEC_RETRY_BACKOFF_BUDGET_MS;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(
            options.deadlineMs + oneFile + DB_ALLOWANCE_MS
        );
    });

    it('wires the run to runFtdIngest with deps built from the deadline callback', async () => {
        mockCreateDeps.mockReturnValue({ marker: 'deps' });
        mockRun.mockResolvedValue({ stoppedBy: 'complete' });
        const options = await capturedOptions();
        const isDeadlineReached = () => false;
        expect(await options.run({ isDeadlineReached })).toEqual({
            stoppedBy: 'complete',
        });
        expect(mockCreateDeps).toHaveBeenCalledWith(isDeadlineReached);
        expect(mockRun).toHaveBeenCalledWith({ marker: 'deps' });
    });
});
