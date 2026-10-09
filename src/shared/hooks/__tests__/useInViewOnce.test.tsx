import { act, renderHook } from '@testing-library/react';
import { useInViewOnce } from '@/shared/hooks/useInViewOnce';

describe('useInViewOnce', () => {
    const original = globalThis.IntersectionObserver;
    let callback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();

    beforeEach(() => {
        callback = null;
        observe.mockClear();
        disconnect.mockClear();
        globalThis.IntersectionObserver = class {
            root = null;
            rootMargin = '';
            scrollMargin = '';
            thresholds: readonly number[] = [];
            constructor(cb: IntersectionObserverCallback) {
                callback = cb;
            }
            observe = observe;
            disconnect = disconnect;
            unobserve = vi.fn();
            takeRecords = vi.fn(() => []);
        } as unknown as typeof IntersectionObserver;
    });
    afterEach(() => {
        globalThis.IntersectionObserver = original;
    });

    it('노드가 붙기 전엔 false, 교차하면 true가 되고 관찰을 끊는다', () => {
        const { result } = renderHook(() => useInViewOnce<HTMLDivElement>());
        expect(result.current[1]).toBe(false);
        const node = document.createElement('div');
        act(() => result.current[0](node));
        expect(observe).toHaveBeenCalledWith(node);
        act(() =>
            callback?.(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                {} as IntersectionObserver
            )
        );
        expect(result.current[1]).toBe(true);
        expect(disconnect).toHaveBeenCalled();
    });

    it('IntersectionObserver가 없는 환경에서는 즉시 true', () => {
        // @ts-expect-error — 구형 브라우저 흉내
        delete globalThis.IntersectionObserver;
        const { result } = renderHook(() => useInViewOnce<HTMLDivElement>());
        expect(result.current[1]).toBe(true);
    });
});
