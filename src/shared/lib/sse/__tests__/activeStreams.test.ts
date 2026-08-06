import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    incrementActiveStreams,
    decrementActiveStreams,
    waitForActiveStreams,
    __resetActiveStreamsForTests,
    __activeStreamCount,
} from '../activeStreams';

describe('activeStreams', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetActiveStreamsForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        __resetActiveStreamsForTests();
    });

    describe('incrementActiveStreams / decrementActiveStreams', () => {
        it('increment이 카운터를 1씩 증가시킨다', () => {
            expect(__activeStreamCount()).toBe(0);
            incrementActiveStreams();
            expect(__activeStreamCount()).toBe(1);
            incrementActiveStreams();
            expect(__activeStreamCount()).toBe(2);
        });

        it('decrement이 카운터를 1씩 감소시킨다', () => {
            incrementActiveStreams();
            incrementActiveStreams();
            decrementActiveStreams();
            expect(__activeStreamCount()).toBe(1);
        });

        it('이미 0인 상태에서 decrement해도 음수가 되지 않는다', () => {
            decrementActiveStreams();
            expect(__activeStreamCount()).toBe(0);
        });
    });

    describe('waitForActiveStreams', () => {
        it('count가 이미 0이면 즉시 resolve한다', async () => {
            const settled = vi.fn();
            void waitForActiveStreams(5000).then(settled);
            // 타이머를 진행하지 않아도 즉시 resolve되어야 한다.
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('count가 0에 도달하면 대기 중인 waiter를 깨운다', async () => {
            incrementActiveStreams();
            const settled = vi.fn();
            void waitForActiveStreams(5000).then(settled);

            await Promise.resolve();
            expect(settled).not.toHaveBeenCalled();

            decrementActiveStreams(); // 0에 도달
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('deadline을 초과하면 count와 무관하게 resolve한다', async () => {
            incrementActiveStreams();
            const settled = vi.fn();
            void waitForActiveStreams(1000).then(settled);

            await Promise.resolve();
            expect(settled).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            await Promise.resolve();
            expect(settled).toHaveBeenCalled();
        });

        it('count가 0에 도달하면 deadline 타이머를 정리해 프로세스가 매달리지 않는다', async () => {
            const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

            incrementActiveStreams();
            void waitForActiveStreams(5000);

            decrementActiveStreams(); // 0에 도달 → timer 정리
            await Promise.resolve();

            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it('여러 waiter가 등록된 경우 count 0 도달 시 모두 깨운다', async () => {
            incrementActiveStreams();
            const settled1 = vi.fn();
            const settled2 = vi.fn();
            void waitForActiveStreams(5000).then(settled1);
            void waitForActiveStreams(5000).then(settled2);

            decrementActiveStreams();
            await Promise.resolve();

            expect(settled1).toHaveBeenCalled();
            expect(settled2).toHaveBeenCalled();
        });
    });
});
