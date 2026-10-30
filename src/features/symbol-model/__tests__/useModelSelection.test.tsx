import { renderHook } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { getAllowedModels } from '@y0ngha/siglens-core';
import { useModelSelection } from '@/features/symbol-model/hooks/useModelSelection';
import { useSelectedModel } from '@/features/symbol-model/hooks/useSelectedModel';

vi.mock('@y0ngha/siglens-core', () => ({
    getModelAccess: () => 'free',
    getAllowedModels: vi.fn(),
}));

const { mockUseUserTier, mockUseDisabledModels } = vi.hoisted(() => ({
    mockUseUserTier: vi.fn(),
    mockUseDisabledModels: vi.fn(),
}));

vi.mock('@/features/symbol-model/hooks/useUserTier', () => ({
    useUserTier: mockUseUserTier,
}));
vi.mock('@/features/symbol-model/hooks/useDisabledServerKeyModels', () => ({
    useDisabledServerKeyModels: mockUseDisabledModels,
}));
vi.mock('@/features/symbol-model/hooks/useSelectedModel', () => ({
    useSelectedModel: vi.fn(),
}));

const FREE = 'gemini-3.5-flash-lite' as ModelId;
const HAIKU = 'claude-haiku-5-5' as ModelId;
const SONNET = 'claude-sonnet-5-5' as ModelId;

describe('useModelSelection', () => {
    beforeEach(() => {
        mockUseUserTier.mockReturnValue({ tier: 'member', isLoading: false });
        mockUseDisabledModels.mockReturnValue({ models: [], isSettled: true });
        vi.mocked(getAllowedModels).mockReturnValue([FREE, HAIKU]);
        vi.mocked(useSelectedModel).mockReturnValue([HAIKU, vi.fn(), true]);
    });

    it('등급 목록은 core getAllowedModels에 현재 tier를 넘겨 얻는다', () => {
        const { result } = renderHook(() => useModelSelection());

        expect(getAllowedModels).toHaveBeenCalledWith('member');
        expect(result.current.allowedModels).toEqual([FREE, HAIKU]);
    });

    it('꺼진 모델은 목록에 남기고 unavailableModels로 표시한다', () => {
        mockUseDisabledModels.mockReturnValue({
            models: [HAIKU, SONNET],
            isSettled: true,
        });

        const { result } = renderHook(() => useModelSelection());

        expect(result.current.unavailableModels).toEqual([HAIKU]);
    });

    it('저장된 선택은 꺼진 모델을 뺀 목록으로 검증한다', () => {
        mockUseDisabledModels.mockReturnValue({
            models: [HAIKU],
            isSettled: true,
        });

        renderHook(() => useModelSelection());

        expect(useSelectedModel).toHaveBeenLastCalledWith([FREE], true);
    });

    it('강등 대상은 고를 수 있는 모델에서 구한다', () => {
        mockUseDisabledModels.mockReturnValue({
            models: [FREE],
            isSettled: true,
        });

        const { result } = renderHook(() => useModelSelection());

        expect(result.current.fallbackModel).toBe(HAIKU);
    });

    it('꺼진 목록 조회가 끝나기 전에는 저장된 선택을 읽지 않는다(이중 분석 방지)', () => {
        mockUseDisabledModels.mockReturnValue({ models: [], isSettled: false });

        renderHook(() => useModelSelection());

        expect(useSelectedModel).toHaveBeenLastCalledWith([FREE, HAIKU], false);
    });

    it('tier가 확정되기 전에는 저장된 선택을 읽지 않는다', () => {
        mockUseUserTier.mockReturnValue({ tier: 'free', isLoading: true });

        renderHook(() => useModelSelection());

        expect(useSelectedModel).toHaveBeenLastCalledWith([FREE, HAIKU], false);
    });

    it('선택 상태(모델·setter·하이드레이션)를 useSelectedModel에서 그대로 옮긴다', () => {
        const setModelId = vi.fn();
        vi.mocked(useSelectedModel).mockReturnValue([FREE, setModelId, false]);

        const { result } = renderHook(() => useModelSelection());

        expect([
            result.current.modelId,
            result.current.setModelId,
            result.current.isHydrated,
        ]).toEqual([FREE, setModelId, false]);
    });
});
