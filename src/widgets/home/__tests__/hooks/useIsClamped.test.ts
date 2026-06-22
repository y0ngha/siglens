// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useIsClamped } from '../../hooks/useIsClamped';

class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('useIsClamped', () => {
    // el != null 실측 경로(measure() → ResizeObserver.observe())는 SkillCard 통합 테스트
    // (SkillsShowcase.test.tsx의 stubClamp + render)가 커버한다. 여기서는 두 early-return 가드만 검증.

    afterAll(() => {
        vi.unstubAllGlobals();
    });

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
