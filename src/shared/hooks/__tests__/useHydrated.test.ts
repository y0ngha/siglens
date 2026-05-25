// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useHydrated } from '@/shared/hooks/useHydrated';

describe('useHydrated', () => {
    it('returns true after hydration', () => {
        const { result } = renderHook(() => useHydrated());
        expect(result.current).toBe(true);
    });

    it('returns a stable boolean value', () => {
        const { result, rerender } = renderHook(() => useHydrated());
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
