// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    NOTICE_REVEAL_DELAY_MS,
    useDeferredReveal,
} from '../hooks/useDeferredReveal';

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

    it('지연 시간이 지나기 직전까지는 false를 유지한다', () => {
        const { result } = renderHook(() => useDeferredReveal());
        act(() => {
            vi.advanceTimersByTime(NOTICE_REVEAL_DELAY_MS - 1);
        });
        expect(result.current).toBe(false);
    });

    it('지연 시간이 지나면 상호작용이 없어도 true가 된다', () => {
        const { result } = renderHook(() => useDeferredReveal());
        act(() => {
            vi.advanceTimersByTime(NOTICE_REVEAL_DELAY_MS);
        });
        expect(result.current).toBe(true);
    });

    it.each(['pointerdown', 'keydown', 'scroll'])(
        '%s가 오면 지연 전에도 즉시 true가 된다',
        eventName => {
            const { result } = renderHook(() => useDeferredReveal());
            act(() => {
                window.dispatchEvent(new Event(eventName));
            });
            expect(result.current).toBe(true);
        }
    );

    it('언마운트 후에는 타이머가 상태를 건드리지 않는다', () => {
        const { unmount } = renderHook(() => useDeferredReveal());
        unmount();
        // 리스너·타이머가 남아 있으면 여기서 unmounted 컴포넌트 경고가 난다.
        expect(() => {
            act(() => {
                vi.advanceTimersByTime(NOTICE_REVEAL_DELAY_MS);
                window.dispatchEvent(new Event('scroll'));
            });
        }).not.toThrow();
    });
});
