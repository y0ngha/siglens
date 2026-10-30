'use client';

import {
    isReasoningToggleable,
    type ModelId,
    type Tier,
} from '@y0ngha/siglens-core';
import { useReasoningToggle } from '@/features/reasoning-toggle/hooks/useReasoningToggle';

/** {@link useEffectiveReasoning}의 결과. 각 필드의 의미는 `SymbolModelContext`의 같은 이름 필드 문서를 따른다. */
export interface EffectiveReasoning {
    reasoning: boolean;
    setReasoning: (value: boolean) => void;
    isReasoningSupported: boolean;
    canUseReasoning: boolean;
    isReasoningHydrated: boolean;
}

/**
 * 회원이 저장한 "깊은 생각" 선호(`useReasoningToggle`)를 등급과 모델로 접어 실제로 보낼 값을 만든다.
 *
 * free(익명 포함) tier는 서버에서도 강제되지만(`resolveReasoning`), 클라에서도 미리 false로
 * 접어 두면 downgrade(로그아웃/등급 하락) 직후 stale true 값이 한 프레임이라도 실제 submit에
 * 실려 나가는 것을 막는다. 등급과 별개로, 토글이 아무 효과도 없는 모델(`off`와 `on`이 같은
 * 모델, core `isReasoningToggleable`이 판정)에서는 컨트롤을 비활성화한다 — 켜도 아무 일이
 * 없는데 켜졌다고 보이는 편이 더 나쁘다.
 */
export function useEffectiveReasoning(
    tier: Tier,
    modelId: ModelId
): EffectiveReasoning {
    const [storedReasoning, setReasoning, isReasoningHydrated] =
        useReasoningToggle();

    const canUseReasoning = tier !== 'free';
    const isReasoningSupported = isReasoningToggleable(modelId);
    const reasoning =
        canUseReasoning && isReasoningSupported && storedReasoning;

    return {
        reasoning,
        setReasoning,
        isReasoningSupported,
        canUseReasoning,
        isReasoningHydrated,
    };
}
