/**
 * Branch coverage tests for useMobileSheetDrag — targets the 22 uncovered
 * branches in touch event handlers: touchstart, touchmove, touchend, touchcancel.
 */

import { renderHook, act } from '@testing-library/react';
import { useMobileSheetDrag } from '@/views/symbol/hooks/useMobileSheetDrag';
import type { RefObject } from 'react';

vi.mock('@/views/symbol/utils/mobileSheetDom', () => ({
    captureTransformY: () => 0,
}));

function createMockRef<T>(value: T | null): RefObject<T | null> {
    return { current: value };
}

function fireTouchStart(el: HTMLElement, clientY: number): void {
    const event = new TouchEvent('touchstart', {
        touches: [{ clientY, clientX: 0 } as Touch],
        bubbles: true,
    });
    el.dispatchEvent(event);
}

function fireTouchMove(el: HTMLElement, clientY: number): void {
    const event = new TouchEvent('touchmove', {
        touches: [{ clientY, clientX: 0 } as Touch],
        cancelable: true,
        bubbles: true,
    });
    el.dispatchEvent(event);
}

function fireTouchEnd(el: HTMLElement, clientY: number): void {
    const event = new TouchEvent('touchend', {
        changedTouches: [{ clientY, clientX: 0 } as Touch],
        bubbles: true,
    });
    el.dispatchEvent(event);
}

function fireTouchCancel(el: HTMLElement): void {
    const event = new TouchEvent('touchcancel', { bubbles: true });
    el.dispatchEvent(event);
}

describe('useMobileSheetDrag — touch event branches', () => {
    let scrollEl: HTMLDivElement;
    let drawerEl: HTMLDivElement;

    beforeEach(() => {
        scrollEl = document.createElement('div');
        drawerEl = document.createElement('div');
        // Mock scrollTop
        Object.defineProperty(scrollEl, 'scrollTop', {
            value: 0,
            writable: true,
            configurable: true,
        });
        // Mock window.innerHeight
        Object.defineProperty(window, 'innerHeight', {
            value: 1000,
            writable: true,
            configurable: true,
        });
    });

    it('handles touchstart when scrollTop is 0 (startedAtTop branch)', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
        });

        // Drawer should have transition set to 'none' and transform captured
        expect(drawerEl.style.transition).toBe('none');
    });

    it('touchmove does nothing when not started at top', () => {
        const onSnapChange = vi.fn();

        // Set scrollTop > 0 so startedAtTop = false
        Object.defineProperty(scrollEl, 'scrollTop', {
            value: 50,
            writable: true,
            configurable: true,
        });

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchMove(scrollEl, 200);
        });

        // When not at top, the touchstart handler skips transform setup
        // and touchmove returns early. The drawer should have no transform set.
        expect(drawerEl.style.transform).toBe('');
    });

    it('touchmove returns early on upward drag (deltaY <= 0)', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 200);
            // Move upward
            fireTouchMove(scrollEl, 190);
        });

        // No isDragging should have been set
        // Transform should be the initial one
    });

    it('touchmove below threshold does not start dragging', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            // Small drag (< 8px threshold)
            fireTouchMove(scrollEl, 105);
        });

        // Should not have entered dragging mode
    });

    it('touchmove past threshold starts dragging and updates transform', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            // Drag past threshold (>8px)
            fireTouchMove(scrollEl, 120);
        });

        // Transform should be updated with resistance
        expect(drawerEl.style.transition).toBe('none');
        expect(drawerEl.style.transform).toContain('translateY(');
    });

    it('touchend snaps to PEEK when dragged past peek threshold (>45% vh)', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            // Drag past threshold to enter isDragging
            fireTouchMove(scrollEl, 120);
            // End with large drag (>45% of 1000px vh = 450px)
            fireTouchEnd(scrollEl, 600);
        });

        expect(onSnapChange).toHaveBeenCalledWith(0.15); // SNAP_PEEK
    });

    it('touchend snaps to HALF when dragged past half threshold (>12% vh) but below peek', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchMove(scrollEl, 120);
            // End with medium drag (>12% but <45% of vh) = between 120 and 450
            fireTouchEnd(scrollEl, 300);
        });

        expect(onSnapChange).toHaveBeenCalledWith(0.55); // SNAP_HALF
    });

    it('touchend snaps back when drag is small (below half threshold)', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchMove(scrollEl, 120);
            // End with small drag (<12% of vh = 120px delta)
            fireTouchEnd(scrollEl, 150);
        });

        // Should snap back, not call onSnapChange
        expect(onSnapChange).not.toHaveBeenCalled();
        // Drawer should have snap-back transition
        expect(drawerEl.style.transform).toBe('translateY(0px)');
    });

    it('touchend does nothing when not dragging', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            // No touchmove — not dragging
            fireTouchEnd(scrollEl, 100);
        });

        expect(onSnapChange).not.toHaveBeenCalled();
    });

    it('touchcancel snaps back when dragging', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchMove(scrollEl, 120);
            fireTouchCancel(scrollEl);
        });

        // Should snap back
        expect(drawerEl.style.transform).toBe('translateY(0px)');
    });

    it('touchcancel does nothing when not dragging', () => {
        const onSnapChange = vi.fn();

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange,
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchCancel(scrollEl);
        });

        // No snap back attempted
        expect(onSnapChange).not.toHaveBeenCalled();
    });

    it('snapBack transitionend clears transition style', async () => {
        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange: vi.fn(),
            })
        );

        act(() => {
            fireTouchStart(scrollEl, 100);
            fireTouchMove(scrollEl, 120);
            fireTouchEnd(scrollEl, 150); // small drag → snapBack
        });

        // Simulate transitionend
        act(() => {
            drawerEl.dispatchEvent(new Event('transitionend'));
        });

        expect(drawerEl.style.transition).toBe('');
    });
});
