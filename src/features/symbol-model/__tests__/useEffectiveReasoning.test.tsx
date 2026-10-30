import { renderHook } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { useEffectiveReasoning } from '@/features/symbol-model/hooks/useEffectiveReasoning';

const { mockUseReasoningToggle, mockIsReasoningToggleable } = vi.hoisted(
    () => ({
        mockUseReasoningToggle: vi.fn(),
        mockIsReasoningToggleable: vi.fn(),
    })
);

vi.mock('@y0ngha/siglens-core', () => ({
    isReasoningToggleable: mockIsReasoningToggleable,
}));

vi.mock('@/features/reasoning-toggle/hooks/useReasoningToggle', () => ({
    useReasoningToggle: mockUseReasoningToggle,
}));

const MODEL = 'claude-sonnet-5-5' as ModelId;

describe('useEffectiveReasoning', () => {
    beforeEach(() => {
        mockUseReasoningToggle.mockReturnValue([true, vi.fn(), true]);
        mockIsReasoningToggleable.mockReturnValue(true);
    });

    describe('free tier', () => {
        it('저장된 선호가 true여도 reasoning=false', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning('free', MODEL)
            );

            expect(result.current.reasoning).toBe(false);
        });

        it('canUseReasoning=false', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning('free', MODEL)
            );

            expect(result.current.canUseReasoning).toBe(false);
        });
    });

    describe.each(['member', 'pro'] as const)('%s tier', tier => {
        it('저장된 true 선호를 그대로 보낸다', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning(tier, MODEL)
            );

            expect(result.current.reasoning).toBe(true);
        });

        it('저장된 false 선호면 reasoning=false', () => {
            mockUseReasoningToggle.mockReturnValue([false, vi.fn(), true]);

            const { result } = renderHook(() =>
                useEffectiveReasoning(tier, MODEL)
            );

            expect(result.current.reasoning).toBe(false);
        });

        it('canUseReasoning=true', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning(tier, MODEL)
            );

            expect(result.current.canUseReasoning).toBe(true);
        });
    });

    describe('토글이 효과 없는 모델', () => {
        beforeEach(() => {
            mockIsReasoningToggleable.mockReturnValue(false);
        });

        it('선택된 모델로 core 판정을 묻고 isReasoningSupported=false', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning('member', MODEL)
            );

            expect(mockIsReasoningToggleable).toHaveBeenCalledWith(MODEL);
            expect(result.current.isReasoningSupported).toBe(false);
        });

        it('회원의 true 선호도 보내지 않는다', () => {
            const { result } = renderHook(() =>
                useEffectiveReasoning('member', MODEL)
            );

            expect(result.current.reasoning).toBe(false);
        });
    });

    it('setReasoning은 저장 토글 setter를 그대로 넘긴다', () => {
        const setReasoning = vi.fn();
        mockUseReasoningToggle.mockReturnValue([false, setReasoning, true]);

        const { result } = renderHook(() =>
            useEffectiveReasoning('member', MODEL)
        );

        expect(result.current.setReasoning).toBe(setReasoning);
    });

    it('isReasoningHydrated는 토글의 하이드레이션 상태를 따른다', () => {
        mockUseReasoningToggle.mockReturnValue([false, vi.fn(), false]);

        const { result } = renderHook(() =>
            useEffectiveReasoning('member', MODEL)
        );

        expect(result.current.isReasoningHydrated).toBe(false);
    });
});
