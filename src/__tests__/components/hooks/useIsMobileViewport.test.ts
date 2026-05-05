/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import {
    MOBILE_VIEWPORT_MEDIA_QUERY,
    useIsMobileViewport,
} from '@/components/hooks/useIsMobileViewport';

describe('useIsMobileViewport', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = false;

    beforeEach(() => {
        listeners.clear();
        matches = false;

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn().mockImplementation((query: string) => ({
                get matches() {
                    return matches;
                },
                media: query,
                onchange: null,
                addEventListener: jest.fn(
                    (
                        eventName: string,
                        listener: (event: MediaQueryListEvent) => void
                    ) => {
                        if (eventName === 'change') listeners.add(listener);
                    }
                ),
                removeEventListener: jest.fn(
                    (
                        eventName: string,
                        listener: (event: MediaQueryListEvent) => void
                    ) => {
                        if (eventName === 'change') listeners.delete(listener);
                    }
                ),
                addListener: jest.fn(),
                removeListener: jest.fn(),
                dispatchEvent: jest.fn(),
            })),
        });
    });

    it('uses the Tailwind md breakpoint boundary', () => {
        expect(MOBILE_VIEWPORT_MEDIA_QUERY).toBe('(max-width: 767px)');
    });

    it('returns false on desktop viewport', () => {
        const { result } = renderHook(() => useIsMobileViewport());

        expect(result.current).toBe(false);
    });

    it('returns true on mobile viewport and reacts to viewport changes', () => {
        matches = true;
        const { result } = renderHook(() => useIsMobileViewport());

        expect(result.current).toBe(true);

        act(() => {
            matches = false;
            listeners.forEach(listener =>
                listener({ matches: false } as MediaQueryListEvent)
            );
        });

        expect(result.current).toBe(false);
    });
});
