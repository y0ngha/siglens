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

/**
 * The hook reads a module-level store that only resets when its LAST
 * subscriber leaves, so a test that leaked a mounted caller would hand the
 * next test a non-initial state. Every hook goes through `mount`, and
 * `afterEach` unmounts whatever a test did not unmount itself — isolation is
 * explicit here rather than riding on RTL's auto-cleanup.
 */
const mounted = new Set<() => void>();

interface MountedHook {
    result: { current: boolean };
    unmount: () => void;
}

function mount(options?: { enabled?: boolean }): MountedHook {
    const rendered = renderHook(() => useHideOnScrollDown(options));
    const unmount = () => {
        if (!mounted.delete(unmount)) return;
        rendered.unmount();
    };
    mounted.add(unmount);
    return { result: rendered.result, unmount };
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
        // Deleting the entry being visited is safe in `Set` iteration.
        for (const unmount of mounted) unmount();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('hides while scrolling down and shows again on the way up', () => {
        const { result } = mount();
        expect(result.current).toBe(false);

        scrollTo(300);
        expect(result.current).toBe(true);

        scrollTo(280);
        expect(result.current).toBe(false);
    });

    /**
     * ChatShell remounts on every conversation switch while the site header
     * stays mounted; a late caller must see the current state, not its own
     * fresh `false` (2026-09-15: conversation bar floated under a hidden header).
     */
    it('a caller mounted after the chrome hid reads the same hidden state', () => {
        const header = mount();
        scrollTo(300);
        expect(header.result.current).toBe(true);

        const bar = mount();
        expect(bar.result.current).toBe(true);

        scrollTo(280);
        expect(header.result.current).toBe(false);
        expect(bar.result.current).toBe(false);
    });

    /** When the last caller leaves, the next session must not inherit "hidden". */
    it('resets to visible once every caller has unmounted', () => {
        const first = mount();
        scrollTo(300);
        expect(first.result.current).toBe(true);
        first.unmount();

        const next = mount();
        expect(next.result.current).toBe(false);
    });

    it('ignores movement smaller than the jitter threshold', () => {
        const { result } = mount();
        scrollTo(300);
        expect(result.current).toBe(true);
        scrollTo(296);
        expect(result.current).toBe(true);
    });

    it('always shows near the top of the page', () => {
        const { result } = mount();
        scrollTo(300);
        scrollTo(40);
        expect(result.current).toBe(false);
    });

    /** MessageList pins to the bottom with scrollIntoView on every streamed token. */
    it('ignores programmatic scrolls that no user input preceded', () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
        const { result } = mount();
        now.mockReturnValue(100_000);
        scrollTo(600, { byUser: false });
        expect(result.current).toBe(false);

        // The next real gesture measures from where auto-scroll left off.
        scrollTo(590);
        expect(result.current).toBe(false);
        scrollTo(700);
        expect(result.current).toBe(true);
    });

    /**
     * The main-host header mounts a disabled caller while ChatShell's bar is
     * enabled. The disabled one must neither report "hidden" nor count as a
     * subscriber that keeps the store alive after the enabled one leaves.
     */
    it('an enabled and a disabled caller mounted together stay independent', () => {
        const disabled = mount({ enabled: false });
        const enabled = mount();
        scrollTo(300);
        expect(enabled.result.current).toBe(true);
        expect(disabled.result.current).toBe(false);

        enabled.unmount();
        const later = mount();
        expect(later.result.current).toBe(false);
        expect(disabled.result.current).toBe(false);
    });

    it('stays visible when disabled', () => {
        const { result } = mount({ enabled: false });
        scrollTo(500);
        expect(result.current).toBe(false);
    });

    /** `inert` (applied by callers) can't be media-query scoped — the hook itself must gate. */
    it('never reports hidden at lg and above, even while scrolling down', () => {
        stubBelowLg(false);
        const { result } = mount();
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

        const { result } = mount();
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

        const { result } = mount();
        scrollTo(300);
        expect(result.current).toBe(true);

        document.body.removeChild(chrome);
    });
});
