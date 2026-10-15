const { mockHandle } = vi.hoisted(() => ({ mockHandle: vi.fn() }));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => ({ db: {} }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '../route';

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
