vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: vi.fn() }));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    checkDatabase,
    checkRedis,
    PING_TIMEOUT_MS,
} from '@/app/api/ready/_lib/checkDependencies';
import { getRedisClient } from '@/shared/cache/redisClient';
import { tryGetDatabaseClient } from '@/shared/db/client';

const INTERNAL_MESSAGE = 'connect ECONNREFUSED 10.0.3.7:5432';

function dbClient(sqlImpl: () => Promise<unknown>): never {
    return { db: {}, sql: vi.fn(sqlImpl) } as never;
}

describe('checkDatabase', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        errorSpy.mockRestore();
    });

    it('클라이언트가 없으면 미구성 사유로 실패한다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(null);
        expect(await checkDatabase()).toEqual({
            ok: false,
            error: 'DATABASE_URL not configured',
        });
    });

    it('핑이 성공하면 ok:true만 돌려준다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => Promise.resolve([]))
        );
        expect(await checkDatabase()).toEqual({ ok: true });
    });

    it('핑이 실패하면 원본 메시지 대신 unreachable을 응답에 싣는다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => Promise.reject(new Error(INTERNAL_MESSAGE)))
        );
        const result = await checkDatabase();
        expect(result).toEqual({ ok: false, error: 'unreachable' });
        expect(JSON.stringify(result)).not.toContain('10.0.3.7');
    });

    it('실패 원문은 서버 로그에 남긴다', async () => {
        const failure = new Error(INTERNAL_MESSAGE);
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => Promise.reject(failure))
        );
        await checkDatabase();
        expect(errorSpy).toHaveBeenCalledWith(
            '[ready] database ping failed:',
            failure
        );
    });

    it('핑이 타임아웃을 넘기면 timeout 사유로 실패한다', async () => {
        vi.useFakeTimers();
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            dbClient(() => new Promise(() => {}))
        );
        const pending = checkDatabase();
        await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS);
        expect(await pending).toEqual({ ok: false, error: 'timeout' });
    });
});

describe('checkRedis', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        errorSpy.mockRestore();
    });

    it('클라이언트가 없으면 미구성 사유로 실패한다', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);
        expect(await checkRedis()).toEqual({
            ok: false,
            error: 'Redis not configured',
        });
    });

    it('PING이 성공하면 ok:true만 돌려준다', async () => {
        vi.mocked(getRedisClient).mockReturnValue({
            ping: vi.fn().mockResolvedValue('PONG'),
        } as never);
        expect(await checkRedis()).toEqual({ ok: true });
    });

    it('PING이 실패하면 원본 메시지 대신 unreachable을 싣고 원문은 로그에 남긴다', async () => {
        const failure = new Error('redis://:secret@10.0.0.9:6379 refused');
        vi.mocked(getRedisClient).mockReturnValue({
            ping: vi.fn().mockRejectedValue(failure),
        } as never);
        expect(await checkRedis()).toEqual({
            ok: false,
            error: 'unreachable',
        });
        expect(errorSpy).toHaveBeenCalledWith(
            '[ready] redis ping failed:',
            failure
        );
    });

    it('PING이 타임아웃을 넘기면 timeout 사유로 실패한다', async () => {
        vi.useFakeTimers();
        vi.mocked(getRedisClient).mockReturnValue({
            ping: vi.fn(() => new Promise(() => {})),
        } as never);
        const pending = checkRedis();
        await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS);
        expect(await pending).toEqual({ ok: false, error: 'timeout' });
    });
});
