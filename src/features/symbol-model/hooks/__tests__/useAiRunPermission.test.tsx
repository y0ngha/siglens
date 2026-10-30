const { mockUseAiAutoRunAllowed } = vi.hoisted(() => ({
    mockUseAiAutoRunAllowed: vi.fn(),
}));
vi.mock('@/features/symbol-model/hooks/useAiAutoRunAllowed', () => ({
    useAiAutoRunAllowed: mockUseAiAutoRunAllowed,
}));

import { act, renderHook } from '@testing-library/react';
import { useAiRunPermission } from '@/features/symbol-model/hooks/useAiRunPermission';

describe('useAiRunPermission', () => {
    const grant = vi.fn();

    beforeEach(() => {
        grant.mockReset();
        mockUseAiAutoRunAllowed.mockReturnValue({ allowed: true, grant });
    });

    it('보이는 위젯은 자동 실행 설정과 grant를 그대로 따른다', () => {
        const { result } = renderHook(() => useAiRunPermission('AAPL', false));

        expect(result.current.allowed).toBe(true);
        result.current.start();
        expect(grant).toHaveBeenCalledTimes(1);
    });

    it('보이는 위젯은 자동 실행이 막혀 있으면 막힌 채로 둔다', () => {
        mockUseAiAutoRunAllowed.mockReturnValue({ allowed: false, grant });

        const { result } = renderHook(() => useAiRunPermission('AAPL', false));

        expect(result.current.allowed).toBe(false);
    });

    it('숨긴 위젯은 자동 실행이 허용돼도 start 전까지 막혀 있다', () => {
        const { result } = renderHook(() => useAiRunPermission('AAPL', true));

        expect(result.current.allowed).toBe(false);
    });

    it('숨긴 위젯은 start를 부르면 열리고 grant는 건드리지 않는다', () => {
        const { result } = renderHook(() => useAiRunPermission('AAPL', true));

        act(() => {
            result.current.start();
        });

        expect(result.current.allowed).toBe(true);
        expect(grant).not.toHaveBeenCalled();
    });
});
