const { mockHandle, mockRun, mockCreateDeps } = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockRun: vi.fn(),
    mockCreateDeps: vi.fn(),
}));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('../createDeps', () => ({
    createAnalysisOutcomesDeps: mockCreateDeps,
}));
vi.mock('@/entities/analysis-outcome/server/runOutcomeLabeller', () => ({
    runOutcomeLabeller: mockRun,
}));
vi.mock('server-only', () => ({}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GROUP_TIMEOUT_MS } from '@/entities/analysis-outcome/lib/outcomePolicy';
import { PATCH } from '../route';

interface CapturedOptions {
    name: string;
    leaseTtlSeconds: number;
    deadlineMs: number;
    run: (context: { isDeadlineReached: () => boolean }) => Promise<unknown>;
}

/** DB-only work around the deadline: a capture chunk (100 rows) in flight, the label chunk's row writes, then relabel and prune (each at most 500 rows). */
const DB_ALLOWANCE_MS = 60_000;

async function optionsOfPatch(): Promise<CapturedOptions> {
    await PATCH(
        new Request('http://localhost/api/cron/analysis-outcomes', {
            method: 'PATCH',
        })
    );
    // Found by the cron name rather than by call position: an earlier test's late call must not take its place.
    const options = mockHandle.mock.calls
        .map(call => call[1] as CapturedOptions)
        .find(candidate => candidate.name === 'analysis-outcomes');
    if (options === undefined) throw new Error('handleLeasedCron not called');
    return options;
}

describe('PATCH /api/cron/analysis-outcomes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
    });

    it('delegates to the leased cron with the documented name, lease and deadline', async () => {
        const options = await optionsOfPatch();
        expect(options).toMatchObject({
            name: 'analysis-outcomes',
            leaseTtlSeconds: 720,
            deadlineMs: 480_000,
        });
        // No `leaseName` override: the helper's own lock-key prefix applies.
        expect(options).not.toHaveProperty('leaseName');
    });

    it('CC-7: the lease outlives the deadline plus one chunk already in flight plus the DB-only steps', async () => {
        const options = await optionsOfPatch();
        const worstCaseMs =
            options.deadlineMs + GROUP_TIMEOUT_MS + DB_ALLOWANCE_MS;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(worstCaseMs);
    });

    it('run builds the deps with the cron deadline probe and returns the labeller summary', async () => {
        const deps = { tag: 'deps' };
        const summary = { labeled: 3 };
        mockCreateDeps.mockReturnValue(deps);
        mockRun.mockResolvedValue(summary);
        const options = await optionsOfPatch();
        const isDeadlineReached = vi.fn(() => false);

        const result = await options.run({ isDeadlineReached });

        expect(result).toBe(summary);
        expect(mockCreateDeps).toHaveBeenCalledWith(isDeadlineReached);
        expect(mockRun).toHaveBeenCalledWith(deps);
    });

    it('run rejects when the deps cannot be built so the helper logs `run failed`', async () => {
        mockCreateDeps.mockImplementation(() => {
            throw new Error('[analysis-outcomes] database unavailable');
        });
        const options = await optionsOfPatch();

        await expect(
            options.run({ isDeadlineReached: () => false })
        ).rejects.toThrow('database unavailable');
        expect(mockRun).not.toHaveBeenCalled();
    });
});
