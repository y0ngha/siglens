// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    NOTICE_IDLE_FALLBACK_MS,
    useDeferredReveal,
} from '../hooks/useDeferredReveal';

interface IdleCallbackStub {
    flush: () => void;
    pendingCount: () => number;
    restore: () => void;
}

/** `requestIdleCallback`을 수동으로 흘려보낼 수 있게 대체한다. */
function stubIdleCallback(): IdleCallbackStub {
    const pending = new Map<number, IdleRequestCallback>();
    let nextId = 1;
    const originalRequest = window.requestIdleCallback;
    const originalCancel = window.cancelIdleCallback;
    window.requestIdleCallback = (callback: IdleRequestCallback): number => {
        const id = nextId;
        nextId += 1;
        pending.set(id, callback);
        return id;
    };
    window.cancelIdleCallback = (id: number): void => {
        pending.delete(id);
    };
    return {
        flush: () => {
            const callbacks = [...pending.values()];
            pending.clear();
            callbacks.forEach(callback =>
                callback({ didTimeout: false, timeRemaining: () => 50 })
            );
        },
        pendingCount: () => pending.size,
        restore: () => {
            window.requestIdleCallback = originalRequest;
            window.cancelIdleCallback = originalCancel;
        },
    };
}

describe('useDeferredReveal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('마운트 직후에는 false다 — 첫 화면을 가리지 않는다', () => {
        const { result } = renderHook(() => useDeferredReveal());
        expect(result.current).toBe(false);
    });

    it.each([
        'pointerdown',
        'keydown',
        'scroll',
        'pointermove',
        'touchstart',
        'wheel',
    ])('%s가 오면 폴백 전에도 true가 된다', eventName => {
        const { result } = renderHook(() => useDeferredReveal());
        act(() => {
            window.dispatchEvent(new Event(eventName));
        });
        expect(result.current).toBe(true);
    });

    /** 예전 8초 폴백은 Lighthouse 측정 창 안이라 입력 없는 측정에서 모달이 떴다. */
    it('폴백은 30초다 — 옛 8초 시점에는 아직 드러내지 않는다', () => {
        expect(NOTICE_IDLE_FALLBACK_MS).toBe(30_000);
        const { result } = renderHook(() => useDeferredReveal());
        act(() => {
            vi.advanceTimersByTime(8_000);
        });
        expect(result.current).toBe(false);
    });

    describe('상호작용이 없을 때의 유휴 폴백', () => {
        let idle: IdleCallbackStub;

        beforeEach(() => {
            idle = stubIdleCallback();
        });
        afterEach(() => {
            idle.restore();
        });

        it('폴백 시간 직전까지는 유휴 콜백도 예약하지 않는다', () => {
            const { result } = renderHook(() => useDeferredReveal());
            act(() => {
                vi.advanceTimersByTime(NOTICE_IDLE_FALLBACK_MS - 1);
            });
            expect(idle.pendingCount()).toBe(0);
            expect(result.current).toBe(false);
        });

        it('폴백 시간이 지나면 유휴 콜백을 예약하고, 그 콜백에서 true가 된다', () => {
            const { result } = renderHook(() => useDeferredReveal());
            act(() => {
                vi.advanceTimersByTime(NOTICE_IDLE_FALLBACK_MS);
            });
            // 타이머만으로는 아직이다 — 브라우저가 한가해질 때까지 기다린다.
            expect(idle.pendingCount()).toBe(1);
            expect(result.current).toBe(false);

            act(() => {
                idle.flush();
            });
            expect(result.current).toBe(true);
        });

        it('언마운트하면 예약된 유휴 콜백을 취소한다', () => {
            const { unmount } = renderHook(() => useDeferredReveal());
            act(() => {
                vi.advanceTimersByTime(NOTICE_IDLE_FALLBACK_MS);
            });
            expect(idle.pendingCount()).toBe(1);
            unmount();
            expect(idle.pendingCount()).toBe(0);
        });
    });

    it('requestIdleCallback이 없는 브라우저(Safari)는 폴백 시간에 곧바로 true가 된다', () => {
        const originalRequest = window.requestIdleCallback;
        Reflect.deleteProperty(window, 'requestIdleCallback');
        try {
            const { result } = renderHook(() => useDeferredReveal());
            act(() => {
                vi.advanceTimersByTime(NOTICE_IDLE_FALLBACK_MS);
            });
            expect(result.current).toBe(true);
        } finally {
            window.requestIdleCallback = originalRequest;
        }
    });

    it('언마운트 후에는 타이머·리스너가 상태를 건드리지 않는다', () => {
        const { unmount } = renderHook(() => useDeferredReveal());
        unmount();
        // 리스너·타이머가 남아 있으면 여기서 unmounted 컴포넌트 경고가 난다.
        expect(() => {
            act(() => {
                vi.advanceTimersByTime(NOTICE_IDLE_FALLBACK_MS);
                window.dispatchEvent(new Event('scroll'));
            });
        }).not.toThrow();
    });
});
