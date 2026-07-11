import { renderHook } from '@testing-library/react';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';

const { mockUseSymbolModel } = vi.hoisted(() => ({
    mockUseSymbolModel: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

describe('useDefaultReasoning', () => {
    it('returns the (tier-gated) reasoning value from SymbolModelContext when true', () => {
        mockUseSymbolModel.mockReturnValue({ reasoning: true });
        const { result } = renderHook(() => useDefaultReasoning());
        expect(result.current).toBe(true);
    });

    it('returns false when SymbolModelContext reasoning is false', () => {
        mockUseSymbolModel.mockReturnValue({ reasoning: false });
        const { result } = renderHook(() => useDefaultReasoning());
        expect(result.current).toBe(false);
    });
});
