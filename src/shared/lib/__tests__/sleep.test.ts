import { sleep } from '@/shared/lib/sleep';

describe('sleep', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a Promise', () => {
        const result = sleep(100);
        expect(result).toBeInstanceOf(Promise);
    });

    it('resolves after the specified delay', async () => {
        const spy = vi.fn();
        sleep(1000).then(spy);

        expect(spy).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(999);
        expect(spy).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(spy).toHaveBeenCalledOnce();
    });

    it('resolves with undefined', async () => {
        const promise = sleep(50);
        await vi.advanceTimersByTimeAsync(50);
        await expect(promise).resolves.toBeUndefined();
    });

    it('handles 0ms delay', async () => {
        const promise = sleep(0);
        await vi.advanceTimersByTimeAsync(0);
        await expect(promise).resolves.toBeUndefined();
    });
});
