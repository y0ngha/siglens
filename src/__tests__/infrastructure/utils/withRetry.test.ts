// `sleep` is the only true side effect inside withRetry. Stubbing it lets each
// test run synchronously and lets us assert on delay schedules without burning
// real wall-clock time. `jest.mock` is hoisted to the top of the file so it
// runs before the static imports below (required by `import/first`).
jest.mock('@/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

import { withRetry } from '@/infrastructure/utils/withRetry';
import { sleep } from '@/lib/sleep';

const sleepMock = sleep as jest.MockedFunction<typeof sleep>;

describe('withRetry', () => {
    beforeEach(() => {
        sleepMock.mockClear();
        // Deterministic jitter so the assertions below can pin exact delays.
        // 0 ⇒ jitter contributes nothing, leaving the pure exponential schedule.
        jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('첫 시도 성공이면 fn 을 1회만 호출하고 sleep 을 호출하지 않는다', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 200,
            isRetryable: () => true,
        });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('transient 실패 후 재시도에 성공하면 결과를 반환한다', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce('eventual');

        const result = await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 200,
            isRetryable: () => true,
        });

        expect(result).toBe('eventual');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(sleepMock).toHaveBeenCalledTimes(1);
    });

    it('maxRetries 초과 시 마지막 에러를 던진다', async () => {
        const finalError = new Error('attempt-3');
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('attempt-0'))
            .mockRejectedValueOnce(new Error('attempt-1'))
            .mockRejectedValueOnce(new Error('attempt-2'))
            .mockRejectedValueOnce(finalError);

        await expect(
            withRetry(fn, {
                maxRetries: 3,
                baseDelayMs: 200,
                isRetryable: () => true,
            })
        ).rejects.toBe(finalError);
        // maxRetries=3 ⇒ 총 4번 호출, 3번의 sleep.
        expect(fn).toHaveBeenCalledTimes(4);
        expect(sleepMock).toHaveBeenCalledTimes(3);
    });

    it('non-retryable 에러는 즉시 던지고 sleep 도 호출하지 않는다', async () => {
        const permanent = new Error('permanent');
        const fn = jest.fn().mockRejectedValue(permanent);
        const isRetryable = jest.fn().mockReturnValue(false);

        await expect(
            withRetry(fn, { maxRetries: 3, baseDelayMs: 200, isRetryable })
        ).rejects.toBe(permanent);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(isRetryable).toHaveBeenCalledWith(permanent);
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('지수 백오프 200 → 400 → 800ms 스케줄로 sleep 을 호출한다', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockRejectedValueOnce(new Error('b'))
            .mockRejectedValueOnce(new Error('c'))
            .mockResolvedValueOnce('done');

        await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 200,
            isRetryable: () => true,
        });

        // Math.random=0 ⇒ jitter=0이므로 순수 지수만 남는다.
        expect(sleepMock).toHaveBeenNthCalledWith(1, 200);
        expect(sleepMock).toHaveBeenNthCalledWith(2, 400);
        expect(sleepMock).toHaveBeenNthCalledWith(3, 800);
    });

    it('jitter는 exponential 의 [0, exponential) 범위에서 더해진다', async () => {
        // Math.random=0.5 ⇒ jitter = exponential * 0.5 = 200 * 0.5 = 100ms.
        (Math.random as jest.Mock).mockReturnValue(0.5);

        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockResolvedValueOnce('done');

        await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 200,
            isRetryable: () => true,
        });

        // 200ms (exponential) + 100ms (jitter) = 300ms.
        expect(sleepMock).toHaveBeenCalledWith(300);
    });

    it('totalTimeoutMs 초과 시 다음 sleep 호출 없이 마지막 에러를 던진다', async () => {
        // Math.random=0 + baseDelayMs=200 ⇒ 첫 sleep=200ms.
        // totalTimeoutMs=50으로 두면 deadline이 즉시 지나 sleep 없이 throw.
        const firstError = new Error('attempt-0');
        const fn = jest.fn().mockRejectedValueOnce(firstError);

        await expect(
            withRetry(fn, {
                maxRetries: 3,
                baseDelayMs: 200,
                isRetryable: () => true,
                totalTimeoutMs: 50,
            })
        ).rejects.toBe(firstError);
        expect(fn).toHaveBeenCalledTimes(1);
        // budget이 잘려서 backoff sleep도 실행되지 않아야 한다.
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('totalTimeoutMs 가 충분하면 정상 backoff 후 성공한다', async () => {
        // 첫 실패 후 200ms sleep까지는 budget 1초 안에 충분히 들어간다.
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 200,
            isRetryable: () => true,
            totalTimeoutMs: 1000,
        });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(sleepMock).toHaveBeenCalledTimes(1);
    });

    it('non-retryable 판정이 중간에 발생해도 즉시 던진다', async () => {
        // 1st: transient retryable, 2nd: non-retryable.
        const transient = new Error('transient');
        const permanent = new Error('permanent');
        const fn = jest
            .fn()
            .mockRejectedValueOnce(transient)
            .mockRejectedValueOnce(permanent);
        const isRetryable = jest
            .fn()
            .mockImplementation((err: unknown) => err === transient);

        await expect(
            withRetry(fn, { maxRetries: 3, baseDelayMs: 200, isRetryable })
        ).rejects.toBe(permanent);
        expect(fn).toHaveBeenCalledTimes(2);
        // 첫 실패에 대한 sleep 1회만 발생.
        expect(sleepMock).toHaveBeenCalledTimes(1);
    });
});
