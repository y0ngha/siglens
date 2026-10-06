import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const slotAcquire = vi.fn();
const flagIsSet = vi.fn();
const flagMark = vi.fn();
const slotArgs: unknown[][] = [];
const flagArgs: unknown[][] = [];

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/createRedisLease', () => ({
    createRedisLease: (...args: unknown[]) => {
        slotArgs.push(args);
        return { tryAcquire: slotAcquire };
    },
}));
vi.mock('@/shared/cache/createRedisFlag', () => ({
    createRedisFlag: (...args: unknown[]) => {
        flagArgs.push(args);
        return { isSet: flagIsSet, mark: flagMark };
    },
}));

const {
    hasPlainGenerationFailedRecently,
    markPlainGenerationFailed,
    releasePlainGenerationLock,
    tryAcquirePlainGenerationLock,
} = await import('../plainGenerationCoordination');

const KEY = {
    promptVersion: 'v9',
    locale: 'ko',
    inputDigest: 'abc',
} as const;

const never = <T>() => new Promise<T>(() => {});

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('plainGenerationCoordination', () => {
    it('락과 실패 표시는 저장 키와 같은 좌표로 서로 다른 키를 쓴다', () => {
        const lockKey = (slotArgs[0][0] as (k: typeof KEY) => string)(KEY);
        const failedKey = (flagArgs[0][0] as (k: typeof KEY) => string)(KEY);
        expect(lockKey).toBe('analysis-plain:lock:v9:ko:abc');
        expect(failedKey).toBe('analysis-plain:failed:v9:ko:abc');
    });

    it('락 TTL은 호출 두 번의 timeout(20초 × 2)을 덮고, 실패 표시 TTL은 5분이다', () => {
        expect(slotArgs[0][1]).toBeGreaterThanOrEqual(40);
        expect(slotArgs[0][1]).toBeLessThanOrEqual(60);
        expect(flagArgs[0][1]).toBe(300);
    });

    it('Redis 결과를 그대로 전달하고, 풀기는 획득한 락 자신의 release로 한다', async () => {
        const release = vi.fn().mockResolvedValue(undefined);
        const acquired = { status: 'acquired', release } as const;
        slotAcquire.mockResolvedValueOnce({ status: 'held' });
        slotAcquire.mockResolvedValueOnce(acquired);
        flagIsSet.mockResolvedValue(true);
        flagMark.mockResolvedValue(undefined);

        expect(await tryAcquirePlainGenerationLock(KEY)).toEqual({
            status: 'held',
        });
        const lease = await tryAcquirePlainGenerationLock(KEY);
        expect(lease).toBe(acquired);
        expect(await hasPlainGenerationFailedRecently(KEY)).toBe(true);
        await releasePlainGenerationLock(acquired);
        await markPlainGenerationFailed(KEY);
        expect(release).toHaveBeenCalledOnce();
        expect(flagMark).toHaveBeenCalledWith(KEY);
    });

    /**
     * `@upstash/redis`는 요청 단위 timeout이 없다 — Redis가 매달리면 이 단계가 그대로
     * 사용자 대기가 되고, 프로세스 안 single-flight 항목도 영영 끝나지 않는다.
     */
    describe('Redis가 매달리면 fail-open 값으로 물러난다', () => {
        it('락은 unavailable(생성은 허용, 풀 것 없음)로 본다', async () => {
            vi.useFakeTimers();
            slotAcquire.mockReturnValue(never<unknown>());
            const pending = tryAcquirePlainGenerationLock(KEY);
            await vi.advanceTimersByTimeAsync(1_000);
            expect(await pending).toEqual({ status: 'unavailable' });
        });

        it('실패 표시는 없는 것으로 본다', async () => {
            vi.useFakeTimers();
            flagIsSet.mockReturnValue(never<boolean>());
            const pending = hasPlainGenerationFailedRecently(KEY);
            await vi.advanceTimersByTimeAsync(1_000);
            expect(await pending).toBe(false);
        });

        it('풀기·표시도 기다리지 않고 끝난다', async () => {
            vi.useFakeTimers();
            flagMark.mockReturnValue(never<void>());
            const release = releasePlainGenerationLock({
                status: 'acquired',
                release: () => never<void>(),
            });
            const mark = markPlainGenerationFailed(KEY);
            await vi.advanceTimersByTimeAsync(1_000);
            await expect(release).resolves.toBeUndefined();
            await expect(mark).resolves.toBeUndefined();
        });
    });
});
