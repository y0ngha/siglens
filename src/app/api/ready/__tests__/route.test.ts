vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: vi.fn(),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { getRedisClient } from '@/shared/cache/redisClient';

/** `SELECT 1`에 성공하는 sql tagged-template를 흉내내는 fake DB 클라이언트. */
function makeDbClient(sqlImpl: () => Promise<unknown>) {
    return { db: {}, sql: vi.fn(sqlImpl) } as never;
}

/** `ping()`을 가진 fake Redis 클라이언트. */
function makeRedis(pingImpl: () => Promise<string>) {
    return { ping: vi.fn(pingImpl) } as never;
}

describe('GET /api/ready', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DB와 Redis가 모두 도달 가능하면 200과 status:ready를 반환한다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            makeDbClient(() => Promise.resolve([{ '?column?': 1 }]))
        );
        vi.mocked(getRedisClient).mockReturnValue(
            makeRedis(() => Promise.resolve('PONG'))
        );

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({
            status: 'ready',
            database: { ok: true },
            redis: { ok: true },
        });
    });

    it('DB 핑이 실패하면 503과 database.ok:false를 반환한다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            makeDbClient(() => Promise.reject(new Error('db down')))
        );
        vi.mocked(getRedisClient).mockReturnValue(
            makeRedis(() => Promise.resolve('PONG'))
        );

        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.status).toBe('not_ready');
        expect(body.database).toEqual({ ok: false, error: 'db down' });
        expect(body.redis.ok).toBe(true);
    });

    it('Redis 핑이 실패하면 503과 redis.ok:false를 반환한다', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            makeDbClient(() => Promise.resolve([{ '?column?': 1 }]))
        );
        vi.mocked(getRedisClient).mockReturnValue(
            makeRedis(() => Promise.reject(new Error('redis down')))
        );

        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.status).toBe('not_ready');
        expect(body.redis).toEqual({ ok: false, error: 'redis down' });
        expect(body.database.ok).toBe(true);
    });

    it('DATABASE_URL 미구성(client null)이면 database.ok:false 사유를 담아 503', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(null);
        vi.mocked(getRedisClient).mockReturnValue(
            makeRedis(() => Promise.resolve('PONG'))
        );

        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.database).toEqual({
            ok: false,
            error: 'DATABASE_URL not configured',
        });
    });

    it('Redis 미구성(client null)이면 redis.ok:false 사유를 담아 503', async () => {
        vi.mocked(tryGetDatabaseClient).mockReturnValue(
            makeDbClient(() => Promise.resolve([{ '?column?': 1 }]))
        );
        vi.mocked(getRedisClient).mockReturnValue(null);

        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.redis).toEqual({
            ok: false,
            error: 'Redis not configured',
        });
    });
});
