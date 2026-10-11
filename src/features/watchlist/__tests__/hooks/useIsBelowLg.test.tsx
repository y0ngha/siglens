import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { useIsBelowLg } from '@/features/watchlist/hooks/useIsBelowLg';

function mockMatchMedia(initial: boolean) {
    const listeners = new Set<() => void>();
    const state = { matches: initial };
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
            return state.matches;
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) =>
            listeners.delete(cb),
    }));
    return {
        listeners,
        set(next: boolean) {
            state.matches = next;
            listeners.forEach(cb => cb());
        },
    };
}

describe('useIsBelowLg', () => {
    const original = window.matchMedia;
    afterEach(() => {
        window.matchMedia = original;
    });

    it('서버 렌더에서는 null(뷰포트를 모른다)', () => {
        mockMatchMedia(true);
        function Probe() {
            return createElement('span', null, String(useIsBelowLg()));
        }
        expect(renderToString(createElement(Probe))).toContain('null');
    });

    it('클라이언트에서는 현재 값을 읽고 변화를 따라간다', () => {
        const media = mockMatchMedia(false);
        const { result, unmount } = renderHook(() => useIsBelowLg());
        expect(result.current).toBe(false);
        act(() => media.set(true));
        expect(result.current).toBe(true);
        unmount();
        expect(media.listeners.size).toBe(0);
    });
});
