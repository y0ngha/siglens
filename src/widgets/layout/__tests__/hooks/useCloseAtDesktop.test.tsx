import { act, renderHook } from '@testing-library/react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { useCloseAtDesktop } from '../../hooks/useCloseAtDesktop';

describe('useCloseAtDesktop', () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const queries: string[] = [];

    beforeEach(() => {
        listeners.clear();
        queries.length = 0;
        window.matchMedia = ((query: string) => {
            queries.push(query);
            return {
                matches: true,
                media: query,
                addEventListener: (
                    _type: string,
                    fn: (event: MediaQueryListEvent) => void
                ) => listeners.add(fn),
                removeEventListener: (
                    _type: string,
                    fn: (event: MediaQueryListEvent) => void
                ) => listeners.delete(fn),
            };
        }) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    const emit = (matches: boolean) =>
        act(() => {
            for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
        });

    it('lg 미만 쿼리가 더 이상 맞지 않으면 콜백을 부른다', () => {
        const onDesktop = vi.fn();
        renderHook(() => useCloseAtDesktop(true, onDesktop));

        emit(false);

        expect(onDesktop).toHaveBeenCalledTimes(1);
        expect(queries).toEqual([BELOW_LG_MEDIA_QUERY]);
    });

    it('여전히 lg 미만이면 부르지 않는다', () => {
        const onDesktop = vi.fn();
        renderHook(() => useCloseAtDesktop(true, onDesktop));

        emit(true);

        expect(onDesktop).not.toHaveBeenCalled();
    });

    it('닫혀 있는 동안에는 구독하지 않는다', () => {
        const onDesktop = vi.fn();
        renderHook(() => useCloseAtDesktop(false, onDesktop));

        emit(false);

        expect(listeners.size).toBe(0);
        expect(onDesktop).not.toHaveBeenCalled();
    });

    it('언마운트하면 구독을 해제한다', () => {
        const { unmount } = renderHook(() => useCloseAtDesktop(true, vi.fn()));

        unmount();

        expect(listeners.size).toBe(0);
    });
});
