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
    DART_CORP_CODE_TIMEOUT_MS,
    DART_MAX_RETRIES,
    DART_QUOTA_GUARD_MAX_REDIS_COMMANDS,
    DART_RETRY_BASE_DELAY_MS,
    __resetDartClientForTests,
} from '@/shared/api/dart/dartClient';
import { REDIS_LONG_COMMAND_TIMEOUT_MS } from '@/shared/cache/redisClient';
import { DART_CRON_LEASE_NAME } from '../../leasedCron';
import { PATCH } from '../route';

/** Unzip + parse + upsert of ≈3k rows: an allowance, not a timeout. */
const WORK_ALLOWANCE_MS = 120_000;

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
        new Request('http://localhost/api/cron/dart-corp-code', {
            method: 'PATCH',
        })
    );
    const call = mockHandle.mock.calls.find(
        ([, options]) => (options as RunOptions).name === 'dart-corp-code'
    );
    return call?.[1] as RunOptions;
}

describe('PATCH /api/cron/dart-corp-code', () => {
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

    it('shares the DART lease with dart-filings', async () => {
        expect(await capturedOptions()).toMatchObject({
            name: 'dart-corp-code',
            leaseName: DART_CRON_LEASE_NAME,
            leaseTtlSeconds: 10 * 60,
        });
    });

    it('CC-7: the lease outlives the one corpCode.xml request at its worst plus the parse and upsert', async () => {
        const options = await capturedOptions();
        const backoffMs =
            2 *
            Array.from({ length: DART_MAX_RETRIES }).reduce<number>(
                (sum, _, attempt) =>
                    sum + DART_RETRY_BASE_DELAY_MS * 2 ** attempt,
                0
            );
        const request =
            (DART_MAX_RETRIES + 1) *
                (DART_CORP_CODE_TIMEOUT_MS +
                    DART_QUOTA_GUARD_MAX_REDIS_COMMANDS *
                        REDIS_LONG_COMMAND_TIMEOUT_MS) +
            backoffMs;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(
            request + WORK_ALLOWANCE_MS
        );
    });

    it('without DART_API_KEY the real run makes zero HTTP requests and reports disabled', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('DART_API_KEY', '');
        vi.stubEnv('E2E_TEST', '');
        const options = await capturedOptions();
        expect(await options.run({ isDeadlineReached: () => false })).toEqual({
            status: 'disabled',
            rows: 0,
            skipped: 0,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
