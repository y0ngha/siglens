// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHideOnScrollDown } from '../hooks/useHideOnScrollDown';

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

/** Stubs `matchMedia` for the hook's own `lg` breakpoint check (below-`lg` by default). */
function stubBelowLg(matches: boolean): void {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

describe('useHideOnScrollDown', () => {
    beforeEach(() => {
        stubBelowLg(true);
        scrollTo(0);
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
            cb(0);
            return 1;
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
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

    /** `inert` (applied by callers) can't be media-query scoped — the hook itself must gate. */
    it('never reports hidden at lg and above, even while scrolling down', () => {
        stubBelowLg(false);
        const { result } = renderHook(() => useHideOnScrollDown());
        scrollTo(300);
        expect(result.current).toBe(false);
    });

    /** `inert` would blur a control the user is mid-interaction with, so hiding
     *  is skipped while focus sits inside the chrome. */
    it('does not hide while a focused control lives inside [data-scroll-chrome]', () => {
        const chrome = document.createElement('div');
        chrome.setAttribute('data-scroll-chrome', '');
        const button = document.createElement('button');
        chrome.appendChild(button);
        document.body.appendChild(chrome);
        button.focus();

        const { result } = renderHook(() => useHideOnScrollDown());
        scrollTo(300);
        expect(result.current).toBe(false);

        document.body.removeChild(chrome);
    });

    it('hides on the same scroll once focus leaves the chrome', () => {
        const chrome = document.createElement('div');
        chrome.setAttribute('data-scroll-chrome', '');
        const button = document.createElement('button');
        chrome.appendChild(button);
        document.body.appendChild(chrome);
        // No focus() call — activeElement stays document.body.

        const { result } = renderHook(() => useHideOnScrollDown());
        scrollTo(300);
        expect(result.current).toBe(true);

        document.body.removeChild(chrome);
    });
});
