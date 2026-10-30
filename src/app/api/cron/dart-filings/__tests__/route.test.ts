const { mockHandle } = vi.hoisted(() => ({ mockHandle: vi.fn() }));
vi.mock('../../leasedCron', async importOriginal => ({
    ...(await importOriginal<typeof import('../../leasedCron')>()),
    handleLeasedCron: mockHandle,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: () => ({ db: {} }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DART_MAX_RETRIES,
    DART_REQUEST_TIMEOUT_MS,
    DART_RETRY_BASE_DELAY_MS,
    __resetDartClientForTests,
} from '@/shared/api/dart/dartClient';
import { DART_QUOTA_GUARD_MAX_REDIS_COMMANDS } from '@/shared/api/dart/dartQuotaGuard';
import { REDIS_LONG_COMMAND_TIMEOUT_MS } from '@/shared/cache/redisClient';
import { DART_CRON_LEASE_NAME } from '../../leasedCron';
import { PATCH } from '../route';

/** DB work after the last corp (upserts, state, the 2-year prune): an allowance, not a timeout. */
const DB_ALLOWANCE_MS = 180_000;
/** `majorstock` + `elestock` for the corp in flight when the deadline passes. */
const CALLS_PER_CORP = 2;

/** Deny-by-default network: any request fails the test. */
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
        new Request('http://localhost/api/cron/dart-filings', {
            method: 'PATCH',
        })
    );
    const call = mockHandle.mock.calls.find(
        ([, options]) => (options as RunOptions).name === 'dart-filings'
    );
    return call?.[1] as RunOptions;
}

describe('PATCH /api/cron/dart-filings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
        vi.stubGlobal('fetch', fetchSpy);
        __resetDartClientForTests();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('shares the DART lease with dart-corp-code, with the documented TTL and deadline', async () => {
        expect(await capturedOptions()).toMatchObject({
            name: 'dart-filings',
            leaseName: DART_CRON_LEASE_NAME,
            leaseTtlSeconds: 30 * 60,
            deadlineMs: 18 * 60 * 1000,
        });
    });

    it('CC-7: the lease outlives the deadline plus one corp in flight and the DB wrap-up', async () => {
        const options = await capturedOptions();
        const backoffMs =
            2 *
            Array.from({ length: DART_MAX_RETRIES }).reduce<number>(
                (sum, _, attempt) =>
                    sum + DART_RETRY_BASE_DELAY_MS * 2 ** attempt,
                0
            ); // doubled for the proportional jitter
        const oneAttempt =
            DART_REQUEST_TIMEOUT_MS +
            DART_QUOTA_GUARD_MAX_REDIS_COMMANDS * REDIS_LONG_COMMAND_TIMEOUT_MS;
        const oneCorp =
            CALLS_PER_CORP * ((DART_MAX_RETRIES + 1) * oneAttempt + backoffMs);
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(
            options.deadlineMs + oneCorp + DB_ALLOWANCE_MS
        );
    });

    it('without DART_API_KEY the real run makes zero HTTP requests and reports disabled', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('DART_API_KEY', '');
        vi.stubEnv('E2E_TEST', '');
        const options = await capturedOptions();
        const result = await options.run({ isDeadlineReached: () => false });
        expect(result).toMatchObject({ status: 'disabled', calls: 0 });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
