vi.mock('server-only', () => ({}));

const {
    mockGet,
    mockSet,
    mockDel,
    mockIncrby,
    mockExpire,
    mockEval,
    mockSadd,
    mockSrem,
    mockSmembers,
    mockRedis,
} = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockDel = vi.fn();
    const mockIncrby = vi.fn();
    const mockExpire = vi.fn();
    const mockEval = vi.fn();
    const mockSadd = vi.fn();
    const mockSrem = vi.fn();
    const mockSmembers = vi.fn();
    const mockRedis: Pick<
        import('@upstash/redis').Redis,
        | 'get'
        | 'set'
        | 'del'
        | 'incrby'
        | 'expire'
        | 'eval'
        | 'sadd'
        | 'srem'
        | 'smembers'
    > = {
        get: mockGet,
        set: mockSet,
        del: mockDel,
        incrby: mockIncrby,
        expire: mockExpire,
        eval: mockEval,
        sadd: mockSadd,
        srem: mockSrem,
        smembers: mockSmembers,
    };
    return {
        mockGet,
        mockSet,
        mockDel,
        mockIncrby,
        mockExpire,
        mockEval,
        mockSadd,
        mockSrem,
        mockSmembers,
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
    advanceRotationCursor,
    prewarmUnitKey,
    markStructurallyUnavailable,
    clearStructurallyUnavailable,
    loadStructurallyUnavailable,
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
        it("ex:1800과 대문자화된 심볼 키로 job-agnostic sentinel 'pending'을 SET한다", async () => {
            await markInFlight('aapl', 'overall');
            expect(mockSet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall',
                'pending',
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

    describe('getInFlightMarker (FIX 1, PR #698 리뷰; FIX 3, 실증)', () => {
        it('get이 임의 문자열을 반환하면 { present: true }를 반환한다', async () => {
            mockGet.mockResolvedValue('a1b2c3d4-uuid');
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
            });
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:inflight:AAPL:overall'
            );
        });

        // FIX 3(실증) — 실제 @upstash/redis 왕복에서는 job-agnostic sentinel이
        // JS **string** `'1'`이 아니라 **number** `1`로 돌아온다(기본
        // automaticDeserialization의 JSON.parse가 유효 JSON 리터럴인 '1'을
        // number로 역직렬화하기 때문). 이전 테스트가 문자열 '1'을 mock해서
        // 프로덕션이 절대 만들지 않는 상태를 검증했고, 그 결과 `value === '1'`
        // 분기가 죽은 코드인 채로 그린을 받았다 — 이 fixture가 그 결함의
        // 재발 방지선이다.
        it('get이 number 1(실제 Upstash JSON.parse 역직렬화 결과)을 반환하면 { present: true }를 반환한다', async () => {
            mockGet.mockResolvedValue(1);
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
            });
        });

        it("get이 job-agnostic sentinel 문자열 'pending'을 반환하면 { present: true }를 반환한다", async () => {
            mockGet.mockResolvedValue('pending');
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
            });
        });

        it("get이 legacy 문자열 '1'을 반환해도(구버전 마커와의 하위호환) { present: true }를 반환한다", async () => {
            mockGet.mockResolvedValue('1');
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: true,
            });
        });

        it('get이 null을 반환하면 { present: false }를 반환한다', async () => {
            mockGet.mockResolvedValue(null);
            expect(await getInFlightMarker('aapl', 'overall')).toEqual({
                present: false,
            });
        });

        it('redis null이면 { present: false } 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(getInFlightMarker('aapl', 'overall')).resolves.toEqual(
                { present: false }
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
                'seo-prewarm:fmp-budget:2026-07-24',
                5
            );
            expect(mockExpire).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-24',
                172800
            );
            expect(result).toBe(42);
        });

        it('redis null이면 0 반환, throw 없음', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await addFmpBudget(5)).toBe(0);
            expect(mockIncrby).not.toHaveBeenCalled();
        });

        /**
         * prewarm 창은 20:30~03:59 UTC로 **UTC 자정을 가로지른다**. 버킷이 UTC 날짜면
         * 하룻밤이 항상 두 키로 쪼개져 각 키가 상한을 따로 세고, 실질 FMP 호출이 상한의
         * 두 배까지 늘어난다. ET 날짜로 잡으면 창 전체가 16:30~23:59 ET 하루에 들어간다.
         */
        it('[회귀] UTC 자정을 사이에 둔 같은 prewarm 밤은 같은 키를 쓴다', async () => {
            mockIncrby.mockResolvedValue(1);

            vi.setSystemTime(new Date('2026-07-24T21:00:00.000Z')); // 17:00 ET 7/24
            await addFmpBudget(1);
            vi.setSystemTime(new Date('2026-07-25T03:00:00.000Z')); // 23:00 ET 7/24
            await addFmpBudget(1);

            const keys = mockIncrby.mock.calls.map(call => call[0]);
            expect(keys).toEqual([
                'seo-prewarm:fmp-budget:2026-07-24',
                'seo-prewarm:fmp-budget:2026-07-24',
            ]);
        });
    });

    describe('getFmpBudgetUsed', () => {
        it('get이 number를 반환하면 그대로 반환한다', async () => {
            mockGet.mockResolvedValue(42);
            expect(await getFmpBudgetUsed()).toBe(42);
            expect(mockGet).toHaveBeenCalledWith(
                'seo-prewarm:fmp-budget:2026-07-24'
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

    describe('advanceRotationCursor (2026-08 감사, KR 5종목 prewarm 미도달)', () => {
        it('INCRBY(rotation-cursor, step)를 호출하고 전진 전 값을 반환한다', async () => {
            // 커서가 이미 10이었고 step=6만큼 전진하면 INCRBY는 새 값 16을
            // 돌려준다 — 함수는 "이번 tick이 쓸" 전진 전 값(10)을 반환해야 한다.
            mockIncrby.mockResolvedValue(16);
            const base = await advanceRotationCursor(6);
            expect(mockIncrby).toHaveBeenCalledWith(
                'seo-prewarm:rotation-cursor',
                6
            );
            expect(base).toBe(10);
        });

        it('키가 처음이면(INCRBY가 step 그대로 반환) 오프셋 0에서 시작한다', async () => {
            mockIncrby.mockResolvedValue(6);
            expect(await advanceRotationCursor(6)).toBe(0);
        });

        it('redis null이면 throw한다(다른 lock.ts 함수와 달리 fail-open 기본값이 없음)', async () => {
            // acquirePrewarmLock이 이미 성공한 뒤에만 도달하는 호출이라(route.ts),
            // 여기서 redis가 null이면 lock.ts 내부 설정이 깨진 것 — 조용히 0을
            // 반환해 오프셋을 창의 시작으로 되돌리는 것보다 fail-loud가 안전하다.
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(advanceRotationCursor(6)).rejects.toThrow(
                'redis unavailable'
            );
            expect(mockIncrby).not.toHaveBeenCalled();
        });
    });

    /**
     * 2026-08-30 인시던트 대응으로 추가된 영속 집합. backoff(`markSkipped`)와 달리
     * TTL이 없다 — "지금은 못 만든다"가 아니라 "데이터가 구조적으로 없다"를 뜻한다.
     */
    describe('구조적 불가 집합', () => {
        describe('prewarmUnitKey', () => {
            it('심볼을 대문자화한 `SYMBOL:tab` 포맷이다', () => {
                expect(prewarmUnitKey('aapl', 'congress')).toBe(
                    'AAPL:congress'
                );
            });

            /**
             * 이 포맷은 `runPrewarmBatch`의 stale 판정이 집합을 조회할 때 쓰는 키이자
             * `findGeneratedAtMap`(DB)이 만드는 맵의 키와 같아야 한다. 셋 중 하나만
             * 바뀌면 조회가 통째로 빗나가는데, 각자 키를 만들면 그 불일치가 어떤
             * 테스트에도 재현되지 않는다.
             */
            it('DB 맵과 같은 포맷을 낸다', () => {
                const row = { symbol: 'AAPL', tab: 'congress' };
                expect(prewarmUnitKey('AAPL', 'congress')).toBe(
                    `${row.symbol}:${row.tab}`
                );
            });
        });

        describe('markStructurallyUnavailable', () => {
            it('정규 키로 SADD를 호출한다', async () => {
                await markStructurallyUnavailable('aapl', 'congress');
                expect(mockSadd).toHaveBeenCalledWith(
                    'seo-prewarm:structural-unavailable',
                    'AAPL:congress'
                );
            });

            it('redis null이면 noop, throw 없음', async () => {
                vi.mocked(getRedisClient).mockReturnValue(null);
                await expect(
                    markStructurallyUnavailable('aapl', 'congress')
                ).resolves.toBeUndefined();
                expect(mockSadd).not.toHaveBeenCalled();
            });
        });

        describe('clearStructurallyUnavailable', () => {
            it('정규 키로 SREM을 호출한다', async () => {
                await clearStructurallyUnavailable('aapl', 'congress');
                expect(mockSrem).toHaveBeenCalledWith(
                    'seo-prewarm:structural-unavailable',
                    'AAPL:congress'
                );
            });

            it('redis null이면 noop, throw 없음', async () => {
                vi.mocked(getRedisClient).mockReturnValue(null);
                await expect(
                    clearStructurallyUnavailable('aapl', 'congress')
                ).resolves.toBeUndefined();
                expect(mockSrem).not.toHaveBeenCalled();
            });
        });

        describe('loadStructurallyUnavailable', () => {
            it('SMEMBERS 결과를 Set으로 준다(배치당 1회)', async () => {
                mockSmembers.mockResolvedValue([
                    'AAPL:congress',
                    'MSFT:options',
                ]);
                const set = await loadStructurallyUnavailable();
                expect(mockSmembers).toHaveBeenCalledWith(
                    'seo-prewarm:structural-unavailable'
                );
                expect(set.has('AAPL:congress')).toBe(true);
                expect(set.has('MSFT:options')).toBe(true);
                expect(set.size).toBe(2);
            });

            /**
             * @upstash/redis는 응답에 JSON.parse를 돌리므로 멤버가 문자열이 아닌
             * 값으로 돌아올 수 있다(`getInFlightMarker`가 number `1`에 물렸던 것과
             * 같은 함정). String()으로 정규화하지 않으면 `has()`가 영영 false다.
             */
            it('숫자로 역직렬화된 멤버도 문자열로 정규화한다', async () => {
                mockSmembers.mockResolvedValue([123, 'AAPL:congress']);
                const set = await loadStructurallyUnavailable();
                expect(set.has('123')).toBe(true);
            });

            it('redis null이면 빈 집합 — 이 수정 이전과 같은 판정으로 degrade', async () => {
                vi.mocked(getRedisClient).mockReturnValue(null);
                const set = await loadStructurallyUnavailable();
                expect(set.size).toBe(0);
                expect(mockSmembers).not.toHaveBeenCalled();
            });
        });
    });
});
