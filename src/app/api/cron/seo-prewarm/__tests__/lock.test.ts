vi.mock('server-only', () => ({}));

const {
    mockGet,
    mockSet,
    mockDel,
    mockIncrby,
    mockExpire,
    mockEval,
    mockRedis,
} = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockDel = vi.fn();
    const mockIncrby = vi.fn();
    const mockExpire = vi.fn();
    const mockEval = vi.fn();
    const mockRedis: Pick<
        import('@upstash/redis').Redis,
        'get' | 'set' | 'del' | 'incrby' | 'expire' | 'eval'
    > = {
        get: mockGet,
        set: mockSet,
        del: mockDel,
        incrby: mockIncrby,
        expire: mockExpire,
        eval: mockEval,
    };
    return {
        mockGet,
        mockSet,
        mockDel,
        mockIncrby,
        mockExpire,
        mockEval,
        mockRedis,
    };
});

vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'token-1'),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import {
    acquirePrewarmLock,
    releasePrewarmLock,
    markInFlight,
    getInFlightMarker,
    clearInFlight,
    markSkipped,
    isSkipped,
    addFmpBudget,
    getFmpBudgetUsed,
} from '../lock';

describe('seo-prewarm lock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-25T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('acquirePrewarmLock', () => {
        it('SET NX EX(900)을 랜덤 토큰 값으로 올바른 키에 호출한다', async () => {
            mockSet.mockResolvedValue('OK');
            await acquirePrewarmLock();
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:lock',
                'token-1',
                {
                    nx: true,
                    ex: 900,
                }
            );
        });

        it("'OK' 응답 시 발급한 토큰 문자열을 반환한다", async () => {
            mockSet.mockResolvedValue('OK');
            expect(await acquirePrewarmLock()).toBe('token-1');
        });

        it('null 응답 시(락 이미 존재) null 반환', async () => {
            mockSet.mockResolvedValue(null);
            expect(await acquirePrewarmLock()).toBeNull();
        });

        it('redis null이면 null 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            await expect(acquirePrewarmLock()).resolves.toBeNull();
            expect(mockSet).not.toHaveBeenCalled();
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });

    describe('releasePrewarmLock', () => {
        it('저장된 값이 토큰과 일치하는 compare-and-delete eval을 올바른 키/인자로 호출한다', async () => {
            mockEval.mockResolvedValue(1);
            await releasePrewarmLock('token-1');
            expect(mockEval).toHaveBeenCalledWith(
                expect.stringContaining("redis.call('get', KEYS[1])"),
                ['seo-prewarm:lock'],
                ['token-1']
            );
        });

        it('저장된 값이 토큰과 일치하면 DEL이 실행된다(eval이 1을 반환)', async () => {
            mockEval.mockResolvedValue(1);
            await expect(
                releasePrewarmLock('token-1')
            ).resolves.toBeUndefined();
            expect(mockEval).toHaveBeenCalledTimes(1);
        });

        it('저장된 값이 토큰과 다르면(다른 실행이 이미 재획득) eval이 0을 반환하고 DEL하지 않는다', async () => {
            mockEval.mockResolvedValue(0);
            await expect(
                releasePrewarmLock('stale-token')
            ).resolves.toBeUndefined();
            // eval 자체는 호출되지만(원자적 비교는 Lua 내부에서 일어남),
            // 반환값 0은 실제 DEL이 일어나지 않았음을 뜻한다 — 여기서는 eval
            // 호출까지만 검증하고 실제 조건 분기는 스크립트 문자열로 커버한다.
            expect(mockEval).toHaveBeenCalledWith(
                expect.any(String),
                ['seo-prewarm:lock'],
                ['stale-token']
            );
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(
                releasePrewarmLock('token-1')
            ).resolves.toBeUndefined();
            expect(mockEval).not.toHaveBeenCalled();
        });
    });

    describe('markInFlight', () => {
        it('ex:1800과 대문자화된 심볼 키로 SET을 호출한다(jobId 생략 시 legacy 값 1)', async () => {
            await markInFlight('aapl', 'overall');
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall',
                '1',
                { ex: 1800 }
            );
        });

        it('jobId를 전달하면 그 값을 SET한다(FIX Z — 다음 tick이 resume-poll할 수 있게)', async () => {
            await markInFlight('aapl', 'overall', 'job-99');
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall',
                'job-99',
                { ex: 1800 }
            );
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(
                markInFlight('aapl', 'overall')
            ).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('getInFlightMarker (FIX 1, PR #698 리뷰)', () => {
        it('get이 jobId 문자열을 반환하면 { present: true, jobId }를 반환한다', async () => {
            mockGet.mockResolvedValue('job-99');
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
                jobId: 'job-99',
            });
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall'
            );
        });

        it("get이 legacy 값 '1'을 반환하면 { present: true, jobId: null }을 반환한다(재개 불가하지만 in-flight)", async () => {
            mockGet.mockResolvedValue('1');
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
                jobId: null,
            });
        });

        it('get이 null을 반환하면 { present: false, jobId: null }을 반환한다', async () => {
            mockGet.mockResolvedValue(null);
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: false,
                jobId: null,
            });
        });

        it('redis null이면 { present: false, jobId: null } 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(getInFlightMarker('aapl', 'overall')).resolves.toEqual(
                { present: false, jobId: null }
            );
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('clearInFlight (FIX Z)', () => {
        it('대문자화된 심볼 키로 DEL을 호출한다', async () => {
            await clearInFlight('aapl', 'overall');
            expect(mockDel).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall'
            );
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(
                clearInFlight('aapl', 'overall')
            ).resolves.toBeUndefined();
            expect(mockDel).not.toHaveBeenCalled();
        });
    });

    describe('markSkipped (FIX C)', () => {
        it('ex:21600(6h)과 대문자화된 심볼 키로 SET을 호출한다', async () => {
            await markSkipped('aapl', 'overall');
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:skip:AAPL:overall',
                '1',
                { ex: 21600 }
            );
        });

        it('redis null이면 noop, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(
                markSkipped('aapl', 'overall')
            ).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });
    });

    describe('isSkipped (FIX C)', () => {
        it('get이 non-null을 반환하면 true', async () => {
            mockGet.mockResolvedValue('1');
            expect(await isSkipped('aapl', 'overall')).toBe(true);
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:skip:AAPL:overall'
            );
        });

        it('get이 null을 반환하면 false', async () => {
            mockGet.mockResolvedValue(null);
            expect(await isSkipped('aapl', 'overall')).toBe(false);
        });

        it('redis null이면 false 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(isSkipped('aapl', 'overall')).resolves.toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('addFmpBudget', () => {
        it('incrby(dateKey, n) 호출 후 expire, incrby 결과를 반환한다', async () => {
            mockIncrby.mockResolvedValue(42);
            const result = await addFmpBudget(5);
            expect(mockIncrby).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25',
                5
            );
            expect(mockExpire).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25',
                172800
            );
            expect(result).toBe(42);
        });

        it('redis null이면 0 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await addFmpBudget(5)).toBe(0);
            expect(mockIncrby).not.toHaveBeenCalled();
        });
    });

    describe('getFmpBudgetUsed', () => {
        it('get이 number를 반환하면 그대로 반환한다', async () => {
            mockGet.mockResolvedValue(42);
            expect(await getFmpBudgetUsed()).toBe(42);
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-25'
            );
        });

        it('get이 string을 반환하면 숫자로 변환한다', async () => {
            mockGet.mockResolvedValue('42');
            expect(await getFmpBudgetUsed()).toBe(42);
        });

        it('get이 null을 반환하면 0을 반환한다', async () => {
            mockGet.mockResolvedValue(null);
            expect(await getFmpBudgetUsed()).toBe(0);
        });

        it('redis null이면 0 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await getFmpBudgetUsed()).toBe(0);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });
});
