// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useIsClamped } from '../../hooks/useIsClamped';

class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

afterAll(() => {
    vi.unstubAllGlobals();
});

describe('useIsClamped', () => {
    it('enabled=false면 측정을 건너뛰고 isClamped=false를 유지한다', () => {
        const { result } = renderHook(() => useIsClamped(false));
        expect(result.current.isClamped).toBe(false);
        expect(result.current.ref.current).toBeNull();
    });

    it('enabled=true여도 ref가 연결되지 않으면(el==null) isClamped=false', () => {
        const { result } = renderHook(() => useIsClamped(true));
        expect(result.current.isClamped).toBe(false);
    });
});
