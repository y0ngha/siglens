import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIdlePreload } from '@/widgets/agent-chat/hooks/useIdlePreload';

const FALLBACK_MS = 2_000;

type IdleWindow = {
    requestIdleCallback?: unknown;
    cancelIdleCallback?: unknown;
};

function stubIdle(
    request: ((cb: () => void) => number) | undefined,
    cancel: ((id: number) => void) | undefined
): void {
    vi.stubGlobal('requestIdleCallback', request);
    vi.stubGlobal('cancelIdleCallback', cancel);
    const w = window as unknown as IdleWindow;
    w.requestIdleCallback = request;
    w.cancelIdleCallback = cancel;
}

describe('useIdlePreload', () => {
    afterEach(() => {
        vi.useRealTimers();
        stubIdle(undefined, undefined);
    });

    describe('with requestIdleCallback', () => {
        it('schedules load on idle and does not call it synchronously', () => {
            const request = vi.fn(() => 7);
            stubIdle(request, vi.fn());
            const load = vi.fn();

            renderHook(() => useIdlePreload(load, true));

            expect(request).toHaveBeenCalledWith(load);
            expect(load).not.toHaveBeenCalled();
        });

        it('cancels the idle callback on unmount', () => {
            const cancel = vi.fn();
            stubIdle(
                vi.fn(() => 7),
                cancel
            );
            const { unmount } = renderHook(() => useIdlePreload(vi.fn(), true));

            unmount();

            expect(cancel).toHaveBeenCalledWith(7);
        });

        it('schedules nothing while disabled', () => {
            const request = vi.fn(() => 7);
            stubIdle(request, vi.fn());

            renderHook(() => useIdlePreload(vi.fn(), false));

            expect(request).not.toHaveBeenCalled();
        });

        it('schedules when enabled flips to true and cancels when it flips back', () => {
            const request = vi.fn(() => 9);
            const cancel = vi.fn();
            stubIdle(request, cancel);
            const load = vi.fn();
            const { rerender } = renderHook(
                ({ enabled }) => useIdlePreload(load, enabled),
                { initialProps: { enabled: false } }
            );

            rerender({ enabled: true });
            expect(request).toHaveBeenCalledTimes(1);

            rerender({ enabled: false });
            expect(cancel).toHaveBeenCalledWith(9);
        });
    });

    describe('without requestIdleCallback', () => {
        it('falls back to a delayed call after the fallback delay', () => {
            vi.useFakeTimers();
            stubIdle(undefined, undefined);
            const load = vi.fn();

            renderHook(() => useIdlePreload(load, true));

            vi.advanceTimersByTime(FALLBACK_MS - 1);
            expect(load).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(load).toHaveBeenCalledTimes(1);
        });

        it('clears the timer on unmount', () => {
            vi.useFakeTimers();
            stubIdle(undefined, undefined);
            const load = vi.fn();
            const { unmount } = renderHook(() => useIdlePreload(load, true));

            unmount();
            vi.advanceTimersByTime(FALLBACK_MS * 2);

            expect(load).not.toHaveBeenCalled();
        });

        it('does not schedule while disabled', () => {
            vi.useFakeTimers();
            stubIdle(undefined, undefined);
            const load = vi.fn();

            renderHook(() => useIdlePreload(load, false));
            vi.advanceTimersByTime(FALLBACK_MS * 2);

            expect(load).not.toHaveBeenCalled();
        });
    });
});
