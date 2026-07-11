'use client';

import { useSymbolModel } from '../model/SymbolModelContext';

/**
 * AI 분석 탭(뉴스, 펀더멘털, 재무, 종합, 옵션, 의회 동향)에서 공통으로 사용하는
 * 효과적(tier-gated) "깊은 생각" reasoning 값을 반환한다 (member-reasoning-toggle
 * spec Part A). 단일 진실값은 SymbolModelContext — 헤더의 ReasoningToggle이 쓰는
 * 것과 동일 상태이므로 탭을 이동해도 값이 일관되게 유지된다.
 *
 * Mirrors `useDefaultModelId` — the value is already tier-gated by
 * `SymbolModelContext` (always `false` for free/anonymous), so every submit
 * call site can pass it straight through without re-deriving tier.
 */
export function useDefaultReasoning(): boolean {
    const { reasoning } = useSymbolModel();
    return reasoning;
}
