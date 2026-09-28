import { act, renderHook } from '@testing-library/react';
import { useCanAnimate } from '../useCanAnimate';

describe('useCanAnimate', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = false;
    const removeEventListener = vi.fn(
        (eventName: string, listener: (event: MediaQueryListEvent) => void) => {
            if (eventName === 'change') listeners.delete(listener);
        }
    );

    beforeEach(() => {
        listeners.clear();
        matches = false;
        removeEventListener.mockClear();

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                get matches() {
                    return matches;
                },
                media: query,
                onchange: null,
                addEventListener: vi.fn(
                    (
                        eventName: string,
                        listener: (event: MediaQueryListEvent) => void
                    ) => {
                        if (eventName === 'change') listeners.add(listener);
                    }
                ),
                removeEventListener,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('returns false when reduced-motion is preferred', () => {
        matches = true;
        const { result } = renderHook(() => useCanAnimate());

        expect(result.current).toBe(false);
    });

    it('returns true when reduced-motion is not preferred, and reacts to changes', () => {
        matches = false;
        const { result } = renderHook(() => useCanAnimate());

        expect(result.current).toBe(true);

        act(() => {
            matches = true;
            listeners.forEach(listener =>
                listener({ matches: true } as MediaQueryListEvent)
            );
        });

        expect(result.current).toBe(false);
    });

    it('removes the change listener on unmount', () => {
        const { unmount } = renderHook(() => useCanAnimate());

        expect(listeners.size).toBe(1);
        unmount();

        expect(removeEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function)
        );
        expect(listeners.size).toBe(0);
    });
});
