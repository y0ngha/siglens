'use client';

import { useSymbolModel } from '../model/SymbolModelContext';

/**
 * AI 분석 탭(뉴스·펀더멘털·재무·종합·옵션·의회 동향)이 제출 전에 기다려야 하는
 * "분석 설정 확정" 게이트. `useDefaultModelId`/`useDefaultReasoning`이 돌려주는
 * 값이 최종값인지 여부를 뜻한다.
 *
 * 단순 `useHydrated()`(마운트 여부)로는 부족하다. modelId와 reasoning은 둘 다
 * tier가 서버에서 확정된 뒤에야 최종값이 되므로(`useSelectedModel`은 tier 확정
 * 후 localStorage를 읽고, reasoning은 free tier에서 강제 false), 마운트 직후에
 * 제출하면 DEFAULT 모델·reasoning=false로 LLM을 한 번 태운 뒤 확정값으로 다시
 * 태우게 된다. 차트 탭의 `useAnalysis`가 isModelHydrated/isReasoningHydrated/
 * isTierHydrated를 모두 기다리는 것과 동일한 게이트다.
 */
export function useAnalysisSettingsHydrated(): boolean {
    const { isHydrated, isReasoningHydrated, isTierHydrated } =
        useSymbolModel();
    return isHydrated && isReasoningHydrated && isTierHydrated;
}
