import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redis, mockGetRedisClient } = vi.hoisted(() => ({
    redis: { set: vi.fn(), eval: vi.fn() },
    mockGetRedisClient: vi.fn(),
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

import {
    acquireTurnLock,
    TURN_LOCK_TTL_SECONDS,
} from '@/app/api/ai/chat/turnLock';

describe('acquireTurnLock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRedisClient.mockReturnValue(redis);
        redis.eval.mockReset().mockResolvedValue(1);
    });

    /**
     * 명령 timeout은 서버가 SET을 반영한 뒤에도 날 수 있다. 그 락이 모르는 토큰으로 12분 남으면
     * 사용자의 다음 턴이 전부 server_busy가 되므로, 같은 토큰으로 compare-and-delete를 시도한다.
     */
    it('set이 timeout으로 던지면 같은 토큰으로 정리 eval을 시도한다(반영 안 됐으면 no-op)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            redis.set.mockRejectedValue(
                new DOMException('timed out', 'TimeoutError')
            );
            expect(await acquireTurnLock('u1')).toBeNull();
            const setToken = redis.set.mock.calls[0]?.[1];
            expect(redis.eval).toHaveBeenCalledWith(
                expect.stringContaining("redis.call('get', KEYS[1])"),
                ['agent:turn-lock:u1'],
                [setToken]
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('정리 eval이 실패해도 acquire는 null로 끝나고 던지지 않는다', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            redis.set.mockRejectedValue(new Error('down'));
            redis.eval.mockRejectedValue(new Error('still down'));
            expect(await acquireTurnLock('u1')).toBeNull();
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(warnSpy).toHaveBeenCalledWith(
                '[agent] turn lock cleanup failed',
                expect.any(Error)
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('SET NX EX 600, release는 저장된 토큰과 일치하는 compare-and-delete eval을 호출한다', async () => {
        redis.set.mockResolvedValue('OK');
        const lock = await acquireTurnLock('u1');
        expect(redis.set).toHaveBeenCalledWith(
            'agent:turn-lock:u1',
            expect.any(String),
            {
                nx: true,
                ex: TURN_LOCK_TTL_SECONDS,
            }
        );
        const setToken =
            redis.set.mock.calls[redis.set.mock.calls.length - 1]?.[1];

        await lock!.release();

        expect(redis.eval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('get', KEYS[1])"),
            ['agent:turn-lock:u1'],
            [setToken]
        );
    });

    it('이미 잡힘(set이 null 반환) → null', async () => {
        redis.set.mockResolvedValue(null);
        expect(await acquireTurnLock('u1')).toBeNull();
    });

    it('set이 reject하면 → null(fail-closed) + 알람 마커 로그', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            redis.set.mockRejectedValue(new Error('down'));
            expect(await acquireTurnLock('u1')).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(
                '[agent] quota store unavailable',
                expect.objectContaining({ op: 'turn-lock' })
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('getRedisClient()가 null이면 → null(fail-closed)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            mockGetRedisClient.mockReturnValue(null);
            expect(await acquireTurnLock('u1')).toBeNull();
            expect(redis.set).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(
                '[agent] quota store unavailable',
                expect.objectContaining({ op: 'turn-lock' })
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('release의 eval 에러는 삼켜지고 로그만 남긴다(throw하지 않는다)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            redis.set.mockResolvedValue('OK');
            redis.eval.mockRejectedValue(new Error('eval failed'));
            const lock = await acquireTurnLock('u1');

            await expect(lock!.release()).resolves.toBeUndefined();

            expect(warnSpy).toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('TURN_LOCK_TTL_SECONDS는 core AGENT_TURN_CAPS.turnDeadlineMs + 최소 120s 여유(저장·정리·재시도된 pre-turn DB콜)', async () => {
        const { AGENT_TURN_CAPS } = await import('@y0ngha/siglens-core');
        const marginMs =
            TURN_LOCK_TTL_SECONDS * 1000 - AGENT_TURN_CAPS.turnDeadlineMs;
        // A margin of exactly the deadline (i.e. dropping back to 660s = 60s margin) must fail
        // this assertion — degraded-Neon `withRetry(DB_TRANSIENT_RETRY)` pre-turn reads can
        // burn well past 60s across the several calls the route makes before the turn even starts.
        expect(marginMs).toBeGreaterThanOrEqual(120_000);
    });
});
