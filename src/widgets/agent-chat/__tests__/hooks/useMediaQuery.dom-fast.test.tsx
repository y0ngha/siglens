import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { removeMatchMedia } from '@/shared/test-utils/matchMedia';
import { useMediaQuery } from '@/widgets/agent-chat/hooks/useMediaQuery';

const QUERY = '(max-width: 1023.98px)';

/** `matches`를 바꾸고 `change`를 쏠 수 있는 matchMedia 스텁. */
function stubMatchMedia(initial: boolean): (next: boolean) => void {
    let matches = initial;
    const listeners = new Set<() => void>();
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            get matches() {
                return query === QUERY ? matches : false;
            },
            media: query,
            addEventListener: (_: string, fn: () => void) => listeners.add(fn),
            removeEventListener: (_: string, fn: () => void) =>
                listeners.delete(fn),
        }),
    });
    return next => {
        matches = next;
        for (const fn of listeners) fn();
    };
}

describe('useMediaQuery', () => {
    it('일치하면 true, 바뀌면 따라간다', () => {
        const change = stubMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery(QUERY));
        expect(result.current).toBe(true);
        act(() => change(false));
        expect(result.current).toBe(false);
    });

    it('matchMedia가 없는 환경에서는 false', () => {
        removeMatchMedia();
        const { result } = renderHook(() => useMediaQuery(QUERY));
        expect(result.current).toBe(false);
    });
});
