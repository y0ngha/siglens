import { renderHook } from '@testing-library/react';
import { useMobileSheetDrag } from '@/views/symbol/hooks/useMobileSheetDrag';
import type { RefObject } from 'react';

function createMockRef<T>(value: T | null): RefObject<T | null> {
    return { current: value };
}

describe('useMobileSheetDrag', () => {
    it('attaches touch listeners when isFullSnap is true', () => {
        const scrollEl = document.createElement('div');
        const drawerEl = document.createElement('div');
        const addSpy = vi.spyOn(scrollEl, 'addEventListener');

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange: vi.fn(),
            })
        );

        const events = addSpy.mock.calls.map(c => c[0]);
        expect(events).toContain('touchstart');
        expect(events).toContain('touchmove');
        expect(events).toContain('touchend');
        expect(events).toContain('touchcancel');

        addSpy.mockRestore();
    });

    it('does not attach listeners when isFullSnap is false', () => {
        const scrollEl = document.createElement('div');
        const drawerEl = document.createElement('div');
        const addSpy = vi.spyOn(scrollEl, 'addEventListener');

        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: false,
                onSnapChange: vi.fn(),
            })
        );

        expect(addSpy).not.toHaveBeenCalled();

        addSpy.mockRestore();
    });

    it('does not attach listeners when refs are null', () => {
        renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef<HTMLDivElement>(null),
                drawerElRef: createMockRef<HTMLDivElement>(null),
                isFullSnap: true,
                onSnapChange: vi.fn(),
            })
        );
    });

    it('removes listeners on unmount', () => {
        const scrollEl = document.createElement('div');
        const drawerEl = document.createElement('div');
        const removeSpy = vi.spyOn(scrollEl, 'removeEventListener');

        const { unmount } = renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange: vi.fn(),
            })
        );

        unmount();

        const events = removeSpy.mock.calls.map(c => c[0]);
        expect(events).toContain('touchstart');
        expect(events).toContain('touchmove');
        expect(events).toContain('touchend');
        expect(events).toContain('touchcancel');

        removeSpy.mockRestore();
    });

    it('clears drawer styles on unmount', () => {
        const scrollEl = document.createElement('div');
        const drawerEl = document.createElement('div');
        drawerEl.style.transform = 'translateY(100px)';
        drawerEl.style.transition = 'transform 0.5s';

        const { unmount } = renderHook(() =>
            useMobileSheetDrag({
                scrollElRef: createMockRef(scrollEl),
                drawerElRef: createMockRef(drawerEl),
                isFullSnap: true,
                onSnapChange: vi.fn(),
            })
        );

        unmount();

        expect(drawerEl.style.transform).toBe('');
        expect(drawerEl.style.transition).toBe('');
    });
});
