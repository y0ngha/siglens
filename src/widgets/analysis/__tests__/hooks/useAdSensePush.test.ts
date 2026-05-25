// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { type RefObject } from 'react';

import { useAdSensePush } from '../../hooks/useAdSensePush';

function createMockRef(width = 300): RefObject<HTMLDivElement> {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({
            width,
            height: 100,
            top: 0,
            left: 0,
            right: width,
            bottom: 100,
        }),
    });
    return { current: el };
}

describe('useAdSensePush', () => {
    let originalResizeObserver: typeof ResizeObserver;
    let mockObserve: ReturnType<typeof vi.fn>;
    let mockDisconnect: ReturnType<typeof vi.fn>;
    let resizeCallback: ResizeObserverCallback;

    beforeEach(() => {
        originalResizeObserver = globalThis.ResizeObserver;
        mockObserve = vi.fn();
        mockDisconnect = vi.fn();

        class MockResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeCallback = callback;
            }
            observe = mockObserve;
            unobserve = vi.fn();
            disconnect = mockDisconnect;
        }

        globalThis.ResizeObserver =
            MockResizeObserver as unknown as typeof ResizeObserver;

        window.adsbygoogle = undefined;
    });

    afterEach(() => {
        globalThis.ResizeObserver = originalResizeObserver;
    });

    it('does not observe when enabled is false', () => {
        const ref = createMockRef();
        renderHook(() => useAdSensePush(ref, false));

        expect(mockObserve).not.toHaveBeenCalled();
    });

    it('observes the container when enabled', () => {
        const ref = createMockRef();
        renderHook(() => useAdSensePush(ref, true));

        expect(mockObserve).toHaveBeenCalledWith(ref.current);
    });

    it('pushes to adsbygoogle when container has width', () => {
        const ref = createMockRef();
        renderHook(() => useAdSensePush(ref, true));

        resizeCallback(
            [
                { contentRect: { width: 300 } },
            ] as unknown as ResizeObserverEntry[],
            {} as ResizeObserver
        );

        expect(window.adsbygoogle).toEqual([{}]);
        expect(mockDisconnect).toHaveBeenCalled();
    });

    it('does not push when container width is 0', () => {
        const ref = createMockRef(0);
        renderHook(() => useAdSensePush(ref, true));

        resizeCallback(
            [{ contentRect: { width: 0 } }] as unknown as ResizeObserverEntry[],
            {} as ResizeObserver
        );

        expect(window.adsbygoogle).toBeUndefined();
    });

    it('disconnects on unmount', () => {
        const ref = createMockRef();
        const { unmount } = renderHook(() => useAdSensePush(ref, true));

        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
    });
});
