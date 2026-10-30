import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createCallDeadline,
    ProviderCallTimeoutError,
    runWithCallDeadline,
    toDeadlineRequestOptions,
} from '@/entities/llm-provider/api/callDeadline';

describe('createCallDeadline', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('timeoutMs가 없으면 signal 없이 작업을 그대로 통과시킨다', async () => {
        const deadline = createCallDeadline(undefined);

        expect(deadline.signal).toBeUndefined();
        await expect(deadline.guard(Promise.resolve('x'))).resolves.toBe('x');
    });

    it('마감이 지나면 signal을 abort하고 guard가 timeout 오류로 거절한다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);
        const assertion = expect(
            deadline.guard(new Promise(() => {}))
        ).rejects.toBeInstanceOf(ProviderCallTimeoutError);

        await vi.advanceTimersByTimeAsync(1_000);
        await assertion;

        expect(deadline.signal?.aborted).toBe(true);
    });

    it('마감 전에 dispose하면 타이머가 정리돼 abort되지 않는다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);

        await expect(deadline.guard(Promise.resolve(1))).resolves.toBe(1);
        deadline.dispose();
        await vi.advanceTimersByTimeAsync(5_000);

        expect(deadline.signal?.aborted).toBe(false);
    });
});

describe('runWithCallDeadline', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('성공하면 결과를 돌려주고 타이머를 푼다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);

        await expect(
            runWithCallDeadline(deadline, () => Promise.resolve('ok'))
        ).resolves.toBe('ok');
        await vi.advanceTimersByTimeAsync(5_000);

        expect(deadline.signal?.aborted).toBe(false);
    });

    it('start가 동기로 던져도 타이머를 풀고 그 오류로 거절한다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);

        await expect(
            runWithCallDeadline(deadline, () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
        await vi.advanceTimersByTimeAsync(5_000);

        expect(deadline.signal?.aborted).toBe(false);
    });

    it('마감이 먼저 지나면 ProviderCallTimeoutError로 거절한다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);
        const assertion = expect(
            runWithCallDeadline(deadline, () => new Promise<string>(() => {}))
        ).rejects.toBeInstanceOf(ProviderCallTimeoutError);

        await vi.advanceTimersByTimeAsync(1_000);
        await assertion;
    });
});

describe('toDeadlineRequestOptions', () => {
    it('마감이 없으면 undefined', () => {
        expect(
            toDeadlineRequestOptions(createCallDeadline(undefined))
        ).toBeUndefined();
    });

    it('마감이 있으면 그 signal을 싣는다', () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);

        expect(toDeadlineRequestOptions(deadline)).toEqual({
            signal: deadline.signal,
        });
        deadline.dispose();
        vi.useRealTimers();
    });
});

describe('ProviderCallTimeoutError', () => {
    it('이름과 timeoutMs를 보존한다', () => {
        const error = new ProviderCallTimeoutError(1500);

        expect(error.name).toBe('ProviderCallTimeoutError');
        expect(error.timeoutMs).toBe(1500);
        expect(error.message).toBe(
            '[llm-provider] call exceeded 1500ms deadline'
        );
    });
});
