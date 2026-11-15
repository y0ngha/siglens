import { withTimeout } from '@/shared/lib/withTimeout';

describe('withTimeout', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('시간 안에 끝나면 작업 결과를 돌려준다', async () => {
        await expect(
            withTimeout(Promise.resolve('done'), 1_000, 'late')
        ).resolves.toBe('done');
    });

    it('시간을 넘기면 onTimeout을 돌려준다', async () => {
        const pending = withTimeout(
            new Promise<string>(() => {}),
            1_000,
            'late'
        );
        await vi.advanceTimersByTimeAsync(1_000);

        await expect(pending).resolves.toBe('late');
    });

    it('작업이 먼저 끝나면 타이머를 남기지 않는다', async () => {
        await withTimeout(Promise.resolve(1), 60_000, 0);

        expect(vi.getTimerCount()).toBe(0);
    });

    it('작업의 실패는 그대로 던진다', async () => {
        await expect(
            withTimeout(Promise.reject(new Error('boom')), 1_000, 'late')
        ).rejects.toThrow('boom');
    });

    it('ms가 0 이하면 다음 틱에 onTimeout으로 끝난다', async () => {
        const pending = withTimeout(new Promise<string>(() => {}), -5, 'late');
        await vi.advanceTimersByTimeAsync(0);

        await expect(pending).resolves.toBe('late');
    });
});
