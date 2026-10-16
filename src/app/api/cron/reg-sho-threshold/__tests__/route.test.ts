const { mockHandle } = vi.hoisted(() => ({ mockHandle: vi.fn() }));
vi.mock('../../leasedCron', () => ({ handleLeasedCron: mockHandle }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => ({ db: {} }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    REG_SHO_MAX_RETRIES,
    REG_SHO_REQUEST_TIMEOUT_MS,
    REG_SHO_RETRY_BASE_DELAY_MS,
} from '@/shared/api/exchange/regShoClient';
import { PATCH } from '../route';

/** DB work after the last list (insert + cursor + prune): an allowance, not a timeout. */
const DB_ALLOWANCE_MS = 30_000;

/** Deny-by-default network: any exchange request fails the test. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

type RunOptions = {
    name: string;
    leaseName?: string;
    leaseTtlSeconds: number;
    deadlineMs: number;
    run: (ctx: { isDeadlineReached: () => boolean }) => Promise<unknown>;
};

async function capturedOptions(): Promise<RunOptions> {
    await PATCH(
        new Request('http://localhost/api/cron/reg-sho-threshold', {
            method: 'PATCH',
        })
    );
    const call = mockHandle.mock.calls.find(
        ([, options]) => (options as RunOptions).name === 'reg-sho-threshold'
    );
    return call?.[1] as RunOptions;
}

describe('PATCH /api/cron/reg-sho-threshold', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
        vi.stubGlobal('fetch', fetchSpy);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('uses its own lease (exchange servers, not the SEC budget) with the documented TTL and deadline', async () => {
        const options = await capturedOptions();
        expect(options).toMatchObject({
            name: 'reg-sho-threshold',
            leaseTtlSeconds: 420,
            deadlineMs: 240_000,
        });
        expect(options.leaseName).toBeUndefined();
    });

    it('CC-7: the lease outlives the deadline plus one list in flight and the DB wrap-up', async () => {
        const options = await capturedOptions();
        const backoffMs =
            2 *
            Array.from({ length: REG_SHO_MAX_RETRIES }).reduce<number>(
                (sum, _, attempt) =>
                    sum + REG_SHO_RETRY_BASE_DELAY_MS * 2 ** attempt,
                0
            ); // doubled for the proportional jitter
        const oneList =
            (REG_SHO_MAX_RETRIES + 1) * REG_SHO_REQUEST_TIMEOUT_MS + backoffMs;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(
            options.deadlineMs + oneList + DB_ALLOWANCE_MS
        );
    });

    it('REG_SHO_THRESHOLD_DATA_ENABLED=false: the real run makes zero HTTP requests and reports disabled', async () => {
        vi.stubEnv('REG_SHO_THRESHOLD_DATA_ENABLED', 'false');
        const options = await capturedOptions();
        const result = await options.run({ isDeadlineReached: () => false });
        expect(result).toMatchObject({
            status: 'disabled',
            listsFetched: 0,
            rowsStored: 0,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
