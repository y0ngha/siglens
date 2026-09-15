// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHideOnScrollDown } from '@/shared/hooks/useHideOnScrollDown';

function scrollTo(
    y: number,
    { byUser = true }: { byUser?: boolean } = {}
): void {
    if (byUser)
        act(() => {
            window.dispatchEvent(new Event('touchmove'));
        });
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    act(() => {
        window.dispatchEvent(new Event('scroll'));
    });
}

describe('useHideOnScrollDown', () => {
    beforeEach(() => {
        scrollTo(0);
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
            cb(0);
            return 1;
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('hides while scrolling down and shows again on the way up', () => {
        const { result } = renderHook(() => useHideOnScrollDown());
        expect(result.current).toBe(false);

        scrollTo(300);
        expect(result.current).toBe(true);

        scrollTo(280);
        expect(result.current).toBe(false);
    });

    it('ignores movement smaller than the jitter threshold', () => {
        const { result } = renderHook(() => useHideOnScrollDown());
        scrollTo(300);
        expect(result.current).toBe(true);
        scrollTo(296);
        expect(result.current).toBe(true);
    });

    it('always shows near the top of the page', () => {
        const { result } = renderHook(() => useHideOnScrollDown());
        scrollTo(300);
        scrollTo(40);
        expect(result.current).toBe(false);
    });

    /** MessageList pins to the bottom with scrollIntoView on every streamed token. */
    it('ignores programmatic scrolls that no user input preceded', () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
        const { result } = renderHook(() => useHideOnScrollDown());
        now.mockReturnValue(100_000);
        scrollTo(600, { byUser: false });
        expect(result.current).toBe(false);

        // The next real gesture measures from where auto-scroll left off.
        scrollTo(590);
        expect(result.current).toBe(false);
        scrollTo(700);
        expect(result.current).toBe(true);
    });

    it('stays visible when disabled', () => {
        const { result } = renderHook(() =>
            useHideOnScrollDown({ enabled: false })
        );
        scrollTo(500);
        expect(result.current).toBe(false);
    });
});
