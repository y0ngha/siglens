const { mockHandle, mockRun, mockCreateDeps } = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockRun: vi.fn(),
    mockCreateDeps: vi.fn(),
}));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('@/entities/investor-flows/server/syncCusipMap', () => ({
    runCusipMapSync: mockRun,
}));
vi.mock('../createDeps', () => ({ createCusipMapDeps: mockCreateDeps }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '../route';

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
    });

    it('wires the run to runCusipMapSync', async () => {
        mockCreateDeps.mockReturnValue({ marker: 'deps' });
        mockRun.mockResolvedValue({ status: 'complete' });
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
        });
        expect(mockRun).toHaveBeenCalledWith({ marker: 'deps' });
    });
});
