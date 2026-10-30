import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import { STREAM_DEADLINE_MS, withDeadline } from '../withDeadline';

describe('withDeadline', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('마감 상수는 10분이다', () => {
        expect(STREAM_DEADLINE_MS).toBe(600_000);
    });

    it('작업이 마감 전에 끝나면 그 결과를 돌려준다', async () => {
        await expect(withDeadline(async () => 'ok', 'timeout')).resolves.toBe(
            'ok'
        );
    });

    it('작업이 먼저 끝나면 마감 타이머를 회수한다', async () => {
        await withDeadline(async () => 'ok', 'timeout');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('작업이 reject하면 그 오류로 reject하고 타이머를 회수한다', async () => {
        const failure = new Error('boom');
        await expect(
            withDeadline(async () => {
                throw failure;
            }, 'timeout')
        ).rejects.toBe(failure);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('run이 동기적으로 throw해도 rejection이 되고 타이머를 회수한다', async () => {
        const failure = new Error('sync');
        await expect(
            withDeadline(() => {
                throw failure;
            }, 'timeout')
        ).rejects.toBe(failure);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('마감을 넘기면 localized 메시지로 reject한다', async () => {
        const pending = withDeadline(
            () => new Promise<never>(() => {}),
            '시간 초과'
        );
        const assertion = expect(pending).rejects.toMatchObject({
            message: '시간 초과',
            localized: true,
        });
        await vi.advanceTimersByTimeAsync(STREAM_DEADLINE_MS);
        await assertion;
        await expect(pending).rejects.toBeInstanceOf(LocalizedStreamError);
    });

    it('마감을 넘기면 작업에 넘긴 signal을 abort한다', async () => {
        let received: AbortSignal | undefined;
        const pending = withDeadline(signal => {
            received = signal;
            return new Promise<never>(() => {});
        }, 'timeout');
        pending.catch(() => {});
        expect(received?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(STREAM_DEADLINE_MS);
        expect(received?.aborted).toBe(true);
    });

    it('마감 직전에는 abort하지 않는다', async () => {
        let received: AbortSignal | undefined;
        const pending = withDeadline(signal => {
            received = signal;
            return new Promise<never>(() => {});
        }, 'timeout');
        pending.catch(() => {});
        await vi.advanceTimersByTimeAsync(STREAM_DEADLINE_MS - 1);
        expect(received?.aborted).toBe(false);
    });
});
