const { mockHandle } = vi.hoisted(() => ({ mockHandle: vi.fn() }));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => ({ db: {} }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FINRA_MAX_RETRIES,
    FINRA_REQUEST_TIMEOUT_MS,
    FINRA_RETRY_BASE_DELAY_MS,
} from '@/shared/api/finra/finraClient';
import { PATCH } from '../route';

/** DB work after the last file (upsert + tag invalidation + two prunes of one day's rows): a generous allowance, not a timeout. */
const DB_ALLOWANCE_MS = 30_000;

/** Deny-by-default network: any FINRA request fails the test. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

describe('PATCH /api/cron/finra-short', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
        vi.stubGlobal('fetch', fetchSpy);
        vi.unstubAllEnvs();
    });

    it('delegates to the leased cron with the documented lease and deadline', async () => {
        await PATCH(
            new Request('http://localhost/api/cron/finra-short', {
                method: 'PATCH',
            })
        );
        const [, options] = mockHandle.mock.calls[0] as [
            Request,
            { name: string; leaseTtlSeconds: number; deadlineMs: number },
        ];
        expect(options).toMatchObject({
            name: 'finra-short',
            leaseTtlSeconds: 720,
            deadlineMs: 480_000,
        });
        // CC-7: the lease outlives the deadline plus ONE file already in flight (the ingester stops starting files and
        // short-interest variants once the deadline passes) — derived from the real client budgets.
        const backoffMs =
            2 *
            Array.from({ length: FINRA_MAX_RETRIES }).reduce<number>(
                (sum, _, attempt) =>
                    sum + FINRA_RETRY_BASE_DELAY_MS * 2 ** attempt,
                0
            ); // doubled for the proportional jitter
        const oneFileWorstMs =
            (FINRA_MAX_RETRIES + 1) * FINRA_REQUEST_TIMEOUT_MS + backoffMs;
        const worstCaseMs =
            options.deadlineMs + oneFileWorstMs + DB_ALLOWANCE_MS;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(worstCaseMs);
    });

    it('FINRA_SHORT_DATA_ENABLED=false: the real run makes zero HTTP requests and reports disabled', async () => {
        vi.stubEnv('FINRA_SHORT_DATA_ENABLED', 'false');
        await PATCH(
            new Request('http://localhost/api/cron/finra-short', {
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
        const result = await options.run({ isDeadlineReached: () => false });
        expect(result).toMatchObject({
            status: 'disabled',
            volumeFiles: 0,
            interestFiles: 0,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
