const { mockHandle, mockRun, mockCreateDeps } = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockRun: vi.fn(),
    mockCreateDeps: vi.fn(),
}));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('@/entities/investor-flows/server/ingest13f', () => ({
    run13fIngest: mockRun,
}));
vi.mock('../createDeps', () => ({ createSec13fDeps: mockCreateDeps }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SEC_HEADER_TIMEOUT_MS,
    SEC_INFO_TABLE_BODY_BUDGET_MS,
    SEC_REQUEST_TIMEOUT_MS,
    SEC_RETRY_BACKOFF_BUDGET_MS,
} from '@/shared/config/investorFlows';
import {
    INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS,
    INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS,
} from '@/entities/investor-flows/lib/investorFlowsPolicy';
import { PATCH } from '../route';

describe('PATCH /api/cron/sec-13f', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
    });

    it('delegates to the leased cron with the documented lease and deadline', async () => {
        const request = new Request('http://localhost/api/cron/sec-13f', {
            method: 'PATCH',
        });
        expect((await PATCH(request)).status).toBe(202);
        const [passed, options] = mockHandle.mock.calls[0] as [
            Request,
            { name: string; leaseTtlSeconds: number; deadlineMs: number },
        ];
        expect(passed).toBe(request);
        expect(options).toMatchObject({
            name: 'sec-13f',
            leaseTtlSeconds: 2100,
            deadlineMs: 600_000,
        });
        // CC-7: the lease outlives the sum of every stage's worst case, derived from the real budgets
        const smallDocument =
            2 * SEC_REQUEST_TIMEOUT_MS + SEC_RETRY_BACKOFF_BUDGET_MS;
        const informationTable =
            2 * SEC_HEADER_TIMEOUT_MS +
            SEC_RETRY_BACKOFF_BUDGET_MS +
            SEC_INFO_TABLE_BODY_BUDGET_MS;
        const inFlightFiling = 2 * smallDocument + informationTable;
        // a RESTATEMENT re-apply download already started when the deadline passes (index.json + information table)
        const inFlightReapply = smallDocument + informationTable;
        const maintenance =
            INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS +
            INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS;
        const worstCaseMs =
            options.deadlineMs +
            inFlightFiling +
            inFlightReapply +
            2 * maintenance; // flush + prune
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(worstCaseMs);
    });

    it('wires the run to run13fIngest with deps built from the deadline callback', async () => {
        mockCreateDeps.mockReturnValue({ marker: 'deps' });
        mockRun.mockResolvedValue({ stoppedBy: 'complete' });
        await PATCH(
            new Request('http://localhost/api/cron/sec-13f', {
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
        const isDeadlineReached = () => true;
        expect(await options.run({ isDeadlineReached })).toEqual({
            stoppedBy: 'complete',
        });
        expect(mockCreateDeps).toHaveBeenCalledWith(isDeadlineReached);
        expect(mockRun).toHaveBeenCalledWith({ marker: 'deps' });
    });
});
