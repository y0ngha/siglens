import { renderHook } from '@testing-library/react';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';

const { mockUseSymbolModel } = vi.hoisted(() => ({
    mockUseSymbolModel: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: mockUseSymbolModel,
}));

describe('useAnalysisSettingsHydrated', () => {
    it('returns true only when model, reasoning, and tier are all hydrated', () => {
        mockUseSymbolModel.mockReturnValue({
            isHydrated: true,
            isReasoningHydrated: true,
            isTierHydrated: true,
        });
        const { result } = renderHook(() => useAnalysisSettingsHydrated());
        expect(result.current).toBe(true);
    });

    it('returns false while modelId hydration is still pending', () => {
        mockUseSymbolModel.mockReturnValue({
            isHydrated: false,
            isReasoningHydrated: true,
            isTierHydrated: true,
        });
        const { result } = renderHook(() => useAnalysisSettingsHydrated());
        expect(result.current).toBe(false);
    });

    it('returns false while reasoning hydration is still pending', () => {
        mockUseSymbolModel.mockReturnValue({
            isHydrated: true,
            isReasoningHydrated: false,
            isTierHydrated: true,
        });
        const { result } = renderHook(() => useAnalysisSettingsHydrated());
        expect(result.current).toBe(false);
    });

    it('returns false while tier hydration is still pending (free-tier reasoning gate)', () => {
        mockUseSymbolModel.mockReturnValue({
            isHydrated: true,
            isReasoningHydrated: true,
            isTierHydrated: false,
        });
        const { result } = renderHook(() => useAnalysisSettingsHydrated());
        expect(result.current).toBe(false);
    });
});
