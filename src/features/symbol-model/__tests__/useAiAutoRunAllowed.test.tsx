import { act, renderHook } from '@testing-library/react';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { __resetHumanInteractionForTests } from '@/shared/lib/humanInteractionStore';

const { mockUseSymbolModel } = vi.hoisted(() => ({
    mockUseSymbolModel: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

describe('useAiAutoRunAllowed', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        __resetHumanInteractionForTests();
        mockUseSymbolModel.mockReturnValue({
            tier: 'free',
            isTierHydrated: true,
        });
    });

    it('큐레이션 종목은 입력 없이도 허용한다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('AAPL'));
        expect(result.current.allowed).toBe(true);
    });

    it('비회원의 롱테일 종목은 입력 전까지 허용하지 않는다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(false);
    });

    it('회원은 롱테일 종목도 허용한다', () => {
        mockUseSymbolModel.mockReturnValue({
            tier: 'member',
            isTierHydrated: true,
        });
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(true);
    });

    it('tier가 확정되기 전에는 회원으로 보지 않는다', () => {
        mockUseSymbolModel.mockReturnValue({
            tier: 'member',
            isTierHydrated: false,
        });
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        expect(result.current.allowed).toBe(false);
    });

    it('grant를 부르면 허용으로 바뀐다', () => {
        const { result } = renderHook(() => useAiAutoRunAllowed('PCLOF'));
        act(() => {
            result.current.grant();
        });
        expect(result.current.allowed).toBe(true);
    });
});
