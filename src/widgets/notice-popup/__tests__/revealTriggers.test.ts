// @vitest-environment jsdom
import {
    INTERACTION_EVENTS,
    listenForFirstInteraction,
    scheduleIdle,
    scheduleIdleAfter,
} from '../utils/revealTriggers';
import { stubIdleCallback } from './idleCallbackStub';

const IDLE_DELAY_MS = 1_000;

describe('revealTriggers', () => {
    const originalRequest = window.requestIdleCallback;
    const originalCancel = window.cancelIdleCallback;

    afterEach(() => {
        window.requestIdleCallback = originalRequest;
        window.cancelIdleCallback = originalCancel;
        vi.useRealTimers();
    });

    describe('listenForFirstInteraction', () => {
        it.each(INTERACTION_EVENTS)('%s 이벤트에 반응한다', eventName => {
            const onInteract = vi.fn();
            const stop = listenForFirstInteraction(onInteract);
            window.dispatchEvent(new Event(eventName));
            stop();
            expect(onInteract).toHaveBeenCalledTimes(1);
        });

        it('같은 이벤트는 한 번만 반응한다(once)', () => {
            const onInteract = vi.fn();
            const stop = listenForFirstInteraction(onInteract);
            window.dispatchEvent(new Event('scroll'));
            window.dispatchEvent(new Event('scroll'));
            stop();
            expect(onInteract).toHaveBeenCalledTimes(1);
        });

        it('정리 함수를 부르면 더는 반응하지 않는다', () => {
            const onInteract = vi.fn();
            listenForFirstInteraction(onInteract)();
            INTERACTION_EVENTS.forEach(eventName =>
                window.dispatchEvent(new Event(eventName))
            );
            expect(onInteract).not.toHaveBeenCalled();
        });
    });

    describe('scheduleIdle', () => {
        it('requestIdleCallback이 있으면 유휴 시점까지 미룬다', () => {
            const idle = stubIdleCallback();
            const callback = vi.fn();
            scheduleIdle(callback);
            expect(callback).not.toHaveBeenCalled();
            idle.flush();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('취소하면 예약된 유휴 콜백을 지운다', () => {
            const idle = stubIdleCallback();
            scheduleIdle(vi.fn())();
            expect(idle.pendingCount()).toBe(0);
        });

        it('requestIdleCallback이 없으면(Safari) 즉시 부른다', () => {
            Reflect.deleteProperty(window, 'requestIdleCallback');
            const callback = vi.fn();
            scheduleIdle(callback);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('scheduleIdleAfter', () => {
        it('지연 시간이 지나기 전에는 유휴 콜백도 예약하지 않는다', () => {
            vi.useFakeTimers();
            const idle = stubIdleCallback();
            scheduleIdleAfter(IDLE_DELAY_MS, vi.fn());
            vi.advanceTimersByTime(IDLE_DELAY_MS - 1);
            expect(idle.pendingCount()).toBe(0);
        });

        it('지연 뒤 유휴 시점에 부른다', () => {
            vi.useFakeTimers();
            const idle = stubIdleCallback();
            const callback = vi.fn();
            scheduleIdleAfter(IDLE_DELAY_MS, callback);
            vi.advanceTimersByTime(IDLE_DELAY_MS);
            expect(callback).not.toHaveBeenCalled();
            idle.flush();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('타이머가 끝나기 전에 취소하면 아무것도 부르지 않는다', () => {
            vi.useFakeTimers();
            const idle = stubIdleCallback();
            const callback = vi.fn();
            scheduleIdleAfter(IDLE_DELAY_MS, callback)();
            vi.advanceTimersByTime(IDLE_DELAY_MS);
            expect(idle.pendingCount()).toBe(0);
            expect(callback).not.toHaveBeenCalled();
        });

        it('타이머가 끝난 뒤 취소하면 예약된 유휴 콜백까지 지운다', () => {
            vi.useFakeTimers();
            const idle = stubIdleCallback();
            const cancel = scheduleIdleAfter(IDLE_DELAY_MS, vi.fn());
            vi.advanceTimersByTime(IDLE_DELAY_MS);
            expect(idle.pendingCount()).toBe(1);
            cancel();
            expect(idle.pendingCount()).toBe(0);
        });
    });
});
