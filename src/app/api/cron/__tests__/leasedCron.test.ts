const { mockAfter, mockFireAndForget, mockTryAcquire, mockCreateLease } =
    vi.hoisted(() => {
        const mockTryAcquire = vi.fn();
        return {
            mockAfter: vi.fn(),
            mockFireAndForget: vi.fn(),
            mockTryAcquire,
            mockCreateLease: vi.fn(
                (
                    _key: (arg: undefined) => string,
                    _ttl: number,
                    _prefix: string
                ) => ({
                    tryAcquire: mockTryAcquire,
                })
            ),
        };
    });

vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('@/shared/lib/backgroundTask', () => ({
    fireAndForget: mockFireAndForget,
}));
vi.mock('@/shared/cache/createRedisLease', () => ({
    createRedisLease: mockCreateLease,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLeasedCron, SEC_CRON_LEASE_NAME } from '../leasedCron';

const OPTIONS = { name: 'sec-13f', leaseTtlSeconds: 900, deadlineMs: 720_000 };

const request = (authorization?: string): Request =>
    new Request('http://localhost/api/cron/sec-13f', {
        method: 'PATCH',
        headers: authorization ? { authorization } : undefined,
    });

async function runAfter(): Promise<void> {
    const callback = mockAfter.mock.calls[0]?.[0] as
        | (() => Promise<void>)
        | undefined;
    expect(callback).toBeTypeOf('function');
    await (callback as () => Promise<void>)();
}

describe('handleLeasedCron', () => {
    const release = vi.fn(async () => undefined);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
        process.env.CRON_SECRET = 'test-secret';
        mockTryAcquire.mockResolvedValue({ status: 'acquired', release });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('authentication', () => {
        it('rejects a missing bearer with 401 before touching Redis or the work', async () => {
            const run = vi.fn();
            const res = await handleLeasedCron(request(), { ...OPTIONS, run });
            expect(res.status).toBe(401);
            expect(mockTryAcquire).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });

        it('rejects a wrong secret with 401', async () => {
            const res = await handleLeasedCron(request('Bearer nope'), {
                ...OPTIONS,
                run: vi.fn(),
            });
            expect(res.status).toBe(401);
        });

        it('fails closed when CRON_SECRET is unset', async () => {
            delete process.env.CRON_SECRET;
            const res = await handleLeasedCron(request('Bearer '), {
                ...OPTIONS,
                run: vi.fn(),
            });
            expect(res.status).toBe(401);
        });
    });

    describe('lease', () => {
        it('uses a per-cron lock key and the configured TTL', async () => {
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run: vi.fn(),
            });
            expect(mockCreateLease).toHaveBeenCalledWith(
                expect.any(Function),
                900,
                '[sec-13f] lease'
            );
            const keyFn = mockCreateLease.mock.calls[0]?.[0] as (
                arg: undefined
            ) => string;
            expect(keyFn(undefined)).toBe('investor-flows:cron-lock:sec-13f');
        });

        it('uses the shared lock key when a lease name is given, keeping the cron name for logs', async () => {
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                name: 'sec-ftd',
                leaseName: SEC_CRON_LEASE_NAME,
                run: vi.fn(),
            });
            const call = mockCreateLease.mock.calls.find(
                ([, , prefix]) => prefix === '[sec-ftd] lease'
            );
            const keyFn = call?.[0] as (arg: undefined) => string;
            expect(keyFn(undefined)).toBe('investor-flows:cron-lock:sec');
        });

        it('also takes each legacy lease key (rollout overlap guard)', async () => {
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                leaseName: SEC_CRON_LEASE_NAME,
                legacyLeaseNames: ['sec-13f'],
                run: vi.fn(),
            });
            const keys = mockCreateLease.mock.calls
                .filter(([, , prefix]) => prefix === '[sec-13f] lease')
                .map(([keyFn]) => keyFn(undefined));
            expect(keys).toEqual([
                'investor-flows:cron-lock:sec',
                'investor-flows:cron-lock:sec-13f',
            ]);
        });

        it('skips with 204 and releases the shared lease when a legacy key is held by an old instance', async () => {
            const releaseShared = vi.fn(async () => undefined);
            mockTryAcquire
                .mockResolvedValueOnce({
                    status: 'acquired',
                    release: releaseShared,
                })
                .mockResolvedValueOnce({ status: 'held' });
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const run = vi.fn();
            const res = await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                leaseName: SEC_CRON_LEASE_NAME,
                legacyLeaseNames: ['sec-13f'],
                run,
            });
            expect(res.status).toBe(204);
            expect(releaseShared).toHaveBeenCalledTimes(1);
            expect(run).not.toHaveBeenCalled();
            expect(mockAfter).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledWith(
                '[sec-13f] lease held — previous run still active, skipping (investor-flows:cron-lock:sec-13f)'
            );
            warn.mockRestore();
        });

        it('releases the shared and the legacy lease after the run', async () => {
            const releaseShared = vi.fn(async () => undefined);
            const releaseLegacy = vi.fn(async () => undefined);
            mockTryAcquire
                .mockResolvedValueOnce({
                    status: 'acquired',
                    release: releaseShared,
                })
                .mockResolvedValueOnce({
                    status: 'acquired',
                    release: releaseLegacy,
                });
            vi.spyOn(console, 'log').mockImplementation(() => {});
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                leaseName: SEC_CRON_LEASE_NAME,
                legacyLeaseNames: ['sec-13f'],
                run: vi.fn(async () => 'ok'),
            });
            await runAfter();
            expect(releaseShared).toHaveBeenCalledTimes(1);
            expect(releaseLegacy).toHaveBeenCalledTimes(1);
        });

        it('logs a metric-filter line when the lease is held (a previous run overran its schedule)', async () => {
            const warn = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);
            mockTryAcquire.mockResolvedValue({ status: 'held' });
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run: vi.fn(),
            });
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('[sec-13f] lease held')
            );
            warn.mockRestore();
        });

        it('returns 204 and runs nothing when the lease is held', async () => {
            mockTryAcquire.mockResolvedValue({ status: 'held' });
            const run = vi.fn();
            const res = await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            expect(res.status).toBe(204);
            expect(mockAfter).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });

        it('fails closed with 204 (and a log) when Redis is unavailable', async () => {
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            mockTryAcquire.mockResolvedValue({ status: 'unavailable' });
            const run = vi.fn();
            const res = await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            expect(res.status).toBe(204);
            expect(run).not.toHaveBeenCalled();
            expect(error).toHaveBeenCalledWith(
                expect.stringContaining('redis unavailable')
            );
            error.mockRestore();
        });
    });

    describe('202 and background run', () => {
        it('answers 202 immediately and registers the work with the drain registry', async () => {
            const run = vi.fn(async () => ({ ok: true }));
            const res = await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            expect(res.status).toBe(202);
            expect(run).not.toHaveBeenCalled(); // not before after()
            expect(mockFireAndForget).toHaveBeenCalledTimes(1);
            expect(mockFireAndForget.mock.calls[0]?.[0]).toBeInstanceOf(
                Promise
            );
        });

        it('runs the work inside after(), logs the result and releases the lease', async () => {
            const log = vi
                .spyOn(console, 'log')
                .mockImplementation(() => undefined);
            const run = vi.fn(async () => ({ filingsProcessed: 3 }));
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            await runAfter();
            expect(run).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                '[sec-13f] run done:',
                '{"filingsProcessed":3}'
            );
            expect(release).toHaveBeenCalledTimes(1);
            log.mockRestore();
        });

        it('releases the lease even when the work throws, and logs the failure', async () => {
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const run = vi.fn(async () => {
                throw new Error('boom');
            });
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            await runAfter();
            expect(release).toHaveBeenCalledTimes(1);
            expect(error).toHaveBeenCalledWith(
                '[sec-13f] run failed:',
                expect.any(Error)
            );
            error.mockRestore();
        });
    });

    describe('deadline', () => {
        it('reports the deadline reached only after deadlineMs has elapsed from the start of the run', async () => {
            const seen: boolean[] = [];
            const run = vi.fn(
                async ({
                    isDeadlineReached,
                }: {
                    isDeadlineReached: () => boolean;
                }) => {
                    seen.push(isDeadlineReached());
                    vi.setSystemTime(Date.now() + 719_999);
                    seen.push(isDeadlineReached());
                    vi.setSystemTime(Date.now() + 1);
                    seen.push(isDeadlineReached());
                }
            );
            vi.spyOn(console, 'log').mockImplementation(() => undefined);
            await handleLeasedCron(request('Bearer test-secret'), {
                ...OPTIONS,
                run,
            });
            await runAfter();
            expect(seen).toEqual([false, false, true]);
        });
    });
});
